import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, promises as fsPromises } from 'node:fs';
import * as path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Transform } from 'node:stream';
import { createGunzip, createGzip } from 'node:zlib';

import {
  BACKUP_AES_ALGORITHM,
  BACKUP_AES_AUTH_TAG_LENGTH,
  BACKUP_AES_IV_LENGTH,
  BACKUP_AUTO_FILENAME_REGEX,
  BACKUP_AUTO_FILE_PREFIX,
  BACKUP_DEFAULT_MANUAL_WARNING_DAYS,
  BACKUP_DEFAULT_RETENTION_DAYS,
  BACKUP_DEFAULT_STORAGE_DIR,
  BACKUP_ENCRYPTION_KEY_ENV,
  BACKUP_FILE_EXTENSION,
  BACKUP_GZIP_LEVEL,
  BACKUP_MANUAL_WARNING_DAYS_ENV,
  BACKUP_METADATA_FILENAME,
  BACKUP_PG_RESTORE_WARNING_EXIT_CODE,
  BACKUP_RETENTION_DAYS_ENV,
  BACKUP_STORAGE_DIR_ENV,
} from '../../constants/backup-constants';
import { resolvePostgresSslOption } from '../../database/postgres-ssl.config';
import { deriveBackupEncryptionKey } from './backup-crypto';
import type {
  BackupFileSummary,
  BackupMetadata,
  BackupStatusResponse,
} from './backup-response-types';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private isAutoBackupInProgress = false;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Streams pg_dump → gzip → AES-256-GCM.
   * File layout: IV (16) + ciphertext + auth tag (16).
   */
  async createBackupStream(): Promise<Readable> {
    const key = this.readEncryptionKey();
    const pgEnv = this.buildPgEnv();
    const child = spawn(
      'pg_dump',
      ['--format=custom', '--no-owner', '--no-privileges', `--dbname=${pgEnv.PGDATABASE}`],
      { env: { ...process.env, ...pgEnv }, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const passThrough = new PassThrough();
    child.on('error', (err: Error) => {
      this.logger.error(`pg_dump spawn failed: ${err.message}`);
      passThrough.destroy(err);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        const errorMsg = stderr.trim() || `pg_dump exited with code ${code}`;
        this.logger.error(`pg_dump failed: ${errorMsg}`);
        passThrough.destroy(new Error(`Database dump failed: ${errorMsg}`));
      }
    });
    if (child.stdout === null) {
      throw new InternalServerErrorException('Failed to start pg_dump');
    }
    const gzip = createGzip({ level: BACKUP_GZIP_LEVEL });
    const iv = randomBytes(BACKUP_AES_IV_LENGTH);
    const cipher = createCipheriv(BACKUP_AES_ALGORITHM, key, iv);
    passThrough.write(iv);
    pipeline(
      child.stdout,
      gzip,
      cipher,
      async function* appendAuthTag(source) {
        for await (const chunk of source) {
          yield chunk;
        }
        yield cipher.getAuthTag();
      },
      passThrough,
    ).catch((err: Error) => {
      this.logger.error(`Backup export pipeline failed: ${err.message}`);
      passThrough.destroy(err);
    });
    return passThrough;
  }

  /**
   * Restores from an encrypted backup buffer (pg_restore --clean --if-exists).
   */
  async restoreBackup(encryptedData: Buffer): Promise<void> {
    const minLength = BACKUP_AES_IV_LENGTH + BACKUP_AES_AUTH_TAG_LENGTH + 1;
    if (encryptedData.length < minLength) {
      throw new BadRequestException('Invalid backup file: too short');
    }
    const key = this.readEncryptionKey();
    const iv = encryptedData.subarray(0, BACKUP_AES_IV_LENGTH);
    const authTag = encryptedData.subarray(encryptedData.length - BACKUP_AES_AUTH_TAG_LENGTH);
    const ciphertext = encryptedData.subarray(
      BACKUP_AES_IV_LENGTH,
      encryptedData.length - BACKUP_AES_AUTH_TAG_LENGTH,
    );
    const decipher = createDecipheriv(BACKUP_AES_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    await this.runPgRestoreStream(Readable.from(ciphertext), decipher, createGunzip(), this.buildPgEnv());
    await this.recordRestore();
  }

  /**
   * Creates an automated backup directly on the host/container volume.
   */
  async createAutoBackup(): Promise<BackupFileSummary> {
    if (this.isAutoBackupInProgress) {
      throw new ConflictException('Automated backup is already in progress');
    }
    this.isAutoBackupInProgress = true;

    try {
      const storageDir = this.resolveStorageDir();
      await fsPromises.mkdir(storageDir, { recursive: true });

      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-');
      const filename = `${BACKUP_AUTO_FILE_PREFIX}${timestamp}${BACKUP_FILE_EXTENSION}`;
      const filePath = path.join(storageDir, filename);
      const tmpFilePath = `${filePath}.tmp`;

      try {
        const stream = await this.createBackupStream();
        const writeStream = createWriteStream(tmpFilePath);
        await pipeline(stream, writeStream);
        await fsPromises.rename(tmpFilePath, filePath);
      } catch (err: unknown) {
        if (existsSync(tmpFilePath)) {
          await fsPromises.unlink(tmpFilePath).catch(() => {});
        }
        throw err;
      }

      const stat = await fsPromises.stat(filePath);
      const createdAtIso = now.toISOString();

      await this.writeMetadata({
        lastAutoBackupAt: createdAtIso,
        lastAutoBackupFilename: filename,
      });

      this.logger.log(`Created automated backup ${filename} (${stat.size} bytes)`);
      return {
        filename,
        createdAt: createdAtIso,
        sizeBytes: stat.size,
      };
    } finally {
      this.isAutoBackupInProgress = false;
    }
  }

  /**
   * Cleans up automated backups that exceed the retention period.
   */
  async purgeOldAutoBackups(): Promise<{ purgedCount: number; freedBytes: number }> {
    const storageDir = this.resolveStorageDir();
    if (!existsSync(storageDir)) {
      return { purgedCount: 0, freedBytes: 0 };
    }

    const retentionDays = this.getRetentionDays();
    const cutoffTimestamp = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    let purgedCount = 0;
    let freedBytes = 0;

    const files = await fsPromises.readdir(storageDir);
    for (const file of files) {
      if (!BACKUP_AUTO_FILENAME_REGEX.test(file)) {
        continue;
      }
      const filePath = path.join(storageDir, file);
      try {
        const stat = await fsPromises.stat(filePath);
        const parsedTime = this.parseBackupTimestamp(file);
        const fileTime = parsedTime ?? stat.mtimeMs;
        if (fileTime < cutoffTimestamp) {
          await fsPromises.unlink(filePath);
          purgedCount += 1;
          freedBytes += stat.size;
          this.logger.log(`Purged expired auto-backup: ${file} (${stat.size} bytes)`);
        }
      } catch (err: unknown) {
        this.logger.warn(`Could not purge backup ${file}: ${String(err)}`);
      }
    }

    return { purgedCount, freedBytes };
  }

  /**
   * Returns backup statistics, last backup timestamps, and warning status.
   */
  async getBackupStatus(): Promise<BackupStatusResponse> {
    const metadata = await this.readMetadata();
    const storageDir = this.resolveStorageDir();
    const autoBackups: BackupFileSummary[] = [];
    let totalStorageSizeBytes = 0;

    if (existsSync(storageDir)) {
      const entries = await fsPromises.readdir(storageDir);
      for (const entry of entries) {
        if (!BACKUP_AUTO_FILENAME_REGEX.test(entry)) {
          continue;
        }
        const filePath = path.join(storageDir, entry);
        try {
          const stat = await fsPromises.stat(filePath);
          const parsedTime = this.parseBackupTimestamp(entry);
          const createdAt = parsedTime
            ? new Date(parsedTime).toISOString()
            : stat.mtime.toISOString();
          totalStorageSizeBytes += stat.size;
          autoBackups.push({
            filename: entry,
            createdAt,
            sizeBytes: stat.size,
          });
        } catch {
          // ignore unreadable file
        }
      }
    }

    // Sort newest first
    autoBackups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const effectiveLastAutoBackupAt =
      metadata.lastAutoBackupAt ?? (autoBackups.length > 0 ? autoBackups[0].createdAt : null);

    const candidates = [metadata.lastManualBackupAt, effectiveLastAutoBackupAt]
      .filter((d): d is string => typeof d === 'string' && d.length > 0)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    const lastBackupAt = candidates.length > 0 ? candidates[0] : null;

    const warningThresholdDays = this.getManualWarningDays();
    let daysSinceLastManualBackup: number | null = null;
    let isManualBackupOverdue = false;

    if (!metadata.lastManualBackupAt) {
      isManualBackupOverdue = true;
    } else {
      const diffMs = Date.now() - new Date(metadata.lastManualBackupAt).getTime();
      daysSinceLastManualBackup = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
      if (daysSinceLastManualBackup >= warningThresholdDays) {
        isManualBackupOverdue = true;
      }
    }

    return {
      lastBackupAt,
      lastManualBackupAt: metadata.lastManualBackupAt,
      lastAutoBackupAt: effectiveLastAutoBackupAt,
      isManualBackupOverdue,
      daysSinceLastManualBackup,
      manualBackupThresholdDays: warningThresholdDays,
      retentionDays: this.getRetentionDays(),
      autoBackupsCount: autoBackups.length,
      totalStorageSizeBytes,
      autoBackups,
    };
  }

  /**
   * Streams a specific automated backup file from the server volume for download.
   */
  async getAutoBackupStream(filename: string): Promise<{ stream: Readable; sizeBytes: number }> {
    if (typeof filename !== 'string' || !BACKUP_AUTO_FILENAME_REGEX.test(filename)) {
      throw new BadRequestException('Invalid backup filename');
    }

    const storageDir = this.resolveStorageDir();
    const filePath = path.resolve(storageDir, filename);

    if (path.dirname(filePath) !== storageDir) {
      throw new BadRequestException('Path traversal attempt detected');
    }

    if (!existsSync(filePath)) {
      throw new NotFoundException(`Backup file ${filename} not found`);
    }

    const stat = await fsPromises.stat(filePath);
    return {
      stream: createReadStream(filePath),
      sizeBytes: stat.size,
    };
  }

  /**
   * Records a manual backup export timestamp in the backup metadata.
   */
  async recordManualBackup(): Promise<void> {
    await this.writeMetadata({ lastManualBackupAt: new Date().toISOString() });
  }

  /**
   * Records a database restore timestamp in the backup metadata.
   */
  async recordRestore(): Promise<void> {
    await this.writeMetadata({ lastRestoreAt: new Date().toISOString() });
  }

  private resolveStorageDir(): string {
    const raw = this.configService.get<string>(
      BACKUP_STORAGE_DIR_ENV,
      BACKUP_DEFAULT_STORAGE_DIR,
    );
    return path.resolve(raw);
  }

  private getRetentionDays(): number {
    const raw = this.configService.get<string>(
      BACKUP_RETENTION_DAYS_ENV,
      String(BACKUP_DEFAULT_RETENTION_DAYS),
    );
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : BACKUP_DEFAULT_RETENTION_DAYS;
  }

  private getManualWarningDays(): number {
    const raw = this.configService.get<string>(
      BACKUP_MANUAL_WARNING_DAYS_ENV,
      String(BACKUP_DEFAULT_MANUAL_WARNING_DAYS),
    );
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : BACKUP_DEFAULT_MANUAL_WARNING_DAYS;
  }

  private async readMetadata(): Promise<BackupMetadata> {
    const metaPath = path.join(this.resolveStorageDir(), BACKUP_METADATA_FILENAME);
    if (!existsSync(metaPath)) {
      return {
        lastAutoBackupAt: null,
        lastAutoBackupFilename: null,
        lastManualBackupAt: null,
        lastRestoreAt: null,
      };
    }
    try {
      const raw = await fsPromises.readFile(metaPath, 'utf8');
      const data = JSON.parse(raw) as Partial<BackupMetadata>;
      return {
        lastAutoBackupAt: typeof data.lastAutoBackupAt === 'string' ? data.lastAutoBackupAt : null,
        lastAutoBackupFilename:
          typeof data.lastAutoBackupFilename === 'string' ? data.lastAutoBackupFilename : null,
        lastManualBackupAt:
          typeof data.lastManualBackupAt === 'string' ? data.lastManualBackupAt : null,
        lastRestoreAt: typeof data.lastRestoreAt === 'string' ? data.lastRestoreAt : null,
      };
    } catch {
      return {
        lastAutoBackupAt: null,
        lastAutoBackupFilename: null,
        lastManualBackupAt: null,
        lastRestoreAt: null,
      };
    }
  }

  private async writeMetadata(updates: Partial<BackupMetadata>): Promise<void> {
    const storageDir = this.resolveStorageDir();
    await fsPromises.mkdir(storageDir, { recursive: true });
    const current = await this.readMetadata();
    const updated: BackupMetadata = {
      ...current,
      ...updates,
    };
    const metaPath = path.join(storageDir, BACKUP_METADATA_FILENAME);
    const tempPath = `${metaPath}.${randomBytes(4).toString('hex')}.tmp`;
    await fsPromises.writeFile(tempPath, JSON.stringify(updated, null, 2), 'utf8');
    await fsPromises.rename(tempPath, metaPath);
  }

  private async runPgRestoreStream(
    sourceStream: Readable,
    decipher: Transform,
    gunzip: Transform,
    pgEnv: Record<string, string>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        'pg_restore',
        [
          '--format=custom',
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-privileges',
          `--dbname=${pgEnv.PGDATABASE}`,
        ],
        { env: { ...process.env, ...pgEnv }, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('error', (err: Error) => {
        this.logger.error(`pg_restore spawn error: ${err.message}`);
        reject(new InternalServerErrorException('Failed to start pg_restore'));
      });
      child.on('close', (code) => {
        if (code !== 0 && code !== BACKUP_PG_RESTORE_WARNING_EXIT_CODE) {
          this.logger.error(`pg_restore exited with code ${code}: ${stderr}`);
          reject(new InternalServerErrorException('pg_restore failed'));
          return;
        }
        resolve();
      });
      pipeline(sourceStream, decipher, gunzip, child.stdin).catch((err: Error) => {
        this.logger.error(`Restore pipeline failed: ${err.message}`);
        reject(new InternalServerErrorException('Restore pipeline failed'));
      });
    });
  }

  private parseBackupTimestamp(filename: string): number | null {
    const match =
      /^backup-auto-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.enc$/.exec(filename);
    if (match) {
      const iso = `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
      const parsed = new Date(iso).getTime();
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private readEncryptionKey(): Buffer {
    const rawKey = this.configService.get<string>(BACKUP_ENCRYPTION_KEY_ENV, '');
    try {
      return deriveBackupEncryptionKey(rawKey);
    } catch {
      throw new InternalServerErrorException(
        `${BACKUP_ENCRYPTION_KEY_ENV} must be at least 32 characters`,
      );
    }
  }

  private buildPgEnv(): Record<string, string> {
    const env: Record<string, string> = {
      PGHOST: this.configService.get<string>('DATABASE_HOST', '127.0.0.1'),
      PGPORT: this.configService.get<string>('DATABASE_PORT', '5432'),
      PGUSER: this.configService.get<string>('DATABASE_USER', ''),
      PGPASSWORD: this.configService.get<string>('DATABASE_PASSWORD', ''),
      PGDATABASE: this.configService.get<string>('DATABASE_NAME', ''),
    };
    const sslConfig = resolvePostgresSslOption((key) => this.configService.get<string>(key));
    if (sslConfig !== false) {
      env.PGSSLMODE = sslConfig.rejectUnauthorized ? 'verify-full' : 'require';
    }
    return env;
  }
}
