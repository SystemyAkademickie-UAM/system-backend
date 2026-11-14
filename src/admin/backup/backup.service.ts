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
  BACKUP_DEFAULT_SCHEDULE_ENABLED,
  BACKUP_DEFAULT_SCHEDULE_INTERVAL,
  BACKUP_DEFAULT_SCHEDULE_TIME,
  BACKUP_DEFAULT_STORAGE_DIR,
  BACKUP_ENCRYPTION_KEY_ENV,
  BACKUP_FILE_EXTENSION,
  BACKUP_GZIP_LEVEL,
  BACKUP_MANUAL_WARNING_DAYS_ENV,
  BACKUP_METADATA_FILENAME,
  BACKUP_PASSWORD_MIN_LENGTH,
  BACKUP_PBKDF2_SALT_LENGTH,
  BACKUP_PG_RESTORE_WARNING_EXIT_CODE,
  BACKUP_RETENTION_DAYS_ENV,
  BACKUP_STORAGE_DIR_ENV,
  BACKUP_V2_MAGIC_HEADER,
} from '../../constants/backup-constants';
import { resolvePostgresSslOption } from '../../database/postgres-ssl.config';
import {
  deriveBackupEncryptionKey,
  deriveKeyFromPassword,
  isV2Backup,
} from './backup-crypto';
import type {
  AutoBackupScheduleConfig,
  AutoBackupScheduleInterval,
  BackupFileSummary,
  BackupMetadata,
  BackupStatusResponse,
} from './backup-response-types';
import type { UpdateAutoBackupScheduleDto } from './dto/backup.dto';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private isAutoBackupInProgress = false;
  private isRestoreInProgress = false;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Streams pg_dump → gzip → AES-256-GCM.
   * If options.password is provided, encrypts with PBKDF2 derived key and prepends V2 magic header + salt.
   * Otherwise, encrypts with the server key (V1).
   */
  async createBackupStream(options?: { password?: string }): Promise<Readable> {
    if (this.isRestoreInProgress) {
      throw new ConflictException(
        'Nie można wykonać kopii zapasowej podczas przywracania bazy danych.',
      );
    }

    let key: Buffer;
    let headerPrefix: Buffer;

    if (options?.password) {
      const password = options.password.trim();
      if (password.length < BACKUP_PASSWORD_MIN_LENGTH) {
        throw new BadRequestException(
          `Password must be at least ${BACKUP_PASSWORD_MIN_LENGTH} characters`,
        );
      }
      const salt = randomBytes(BACKUP_PBKDF2_SALT_LENGTH);
      key = deriveKeyFromPassword(password, salt);
      const iv = randomBytes(BACKUP_AES_IV_LENGTH);
      headerPrefix = Buffer.concat([BACKUP_V2_MAGIC_HEADER, salt, iv]);
      return this.executeDumpPipeline(key, iv, headerPrefix);
    }

    key = this.readEncryptionKey();
    const iv = randomBytes(BACKUP_AES_IV_LENGTH);
    headerPrefix = iv;
    return this.executeDumpPipeline(key, iv, headerPrefix);
  }

  private async executeDumpPipeline(
    key: Buffer,
    iv: Buffer,
    headerPrefix: Buffer,
  ): Promise<Readable> {
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
    const cipher = createCipheriv(BACKUP_AES_ALGORITHM, key, iv);
    passThrough.write(headerPrefix);
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
   * Supports both V2 (password-encrypted) and V1 (server-key encrypted) backups.
   * Cryptographic verification (authTag) is performed in memory BEFORE spawning pg_restore,
   * preventing the Cryptographic Doom Principle (executing unauthenticated data).
   */
  async restoreBackup(encryptedData: Buffer, password?: string): Promise<void> {
    if (this.isRestoreInProgress) {
      throw new ConflictException('Operacja przywracania bazy danych jest już w toku.');
    }
    if (this.isAutoBackupInProgress) {
      throw new ConflictException(
        'Nie można przywrócić bazy danych podczas wykonywania kopii zapasowej.',
      );
    }
    this.isRestoreInProgress = true;
    try {
      let decryptedGzip: Buffer;

      if (isV2Backup(encryptedData)) {
        const minLength =
          BACKUP_V2_MAGIC_HEADER.length +
          BACKUP_PBKDF2_SALT_LENGTH +
          BACKUP_AES_IV_LENGTH +
          BACKUP_AES_AUTH_TAG_LENGTH +
          1;
        if (encryptedData.length < minLength) {
          throw new BadRequestException('Nieprawidłowy plik kopii zapasowej: plik jest zbyt krótki.');
        }
        if (!password || password.trim().length === 0) {
          throw new BadRequestException(
            'Kopia zapasowa jest zabezpieczona hasłem. Wprowadź hasło szyfrowania.',
          );
        }
        const saltOffset = BACKUP_V2_MAGIC_HEADER.length;
        const ivOffset = saltOffset + BACKUP_PBKDF2_SALT_LENGTH;
        const ciphertextOffset = ivOffset + BACKUP_AES_IV_LENGTH;

        const salt = encryptedData.subarray(saltOffset, ivOffset);
        const iv = encryptedData.subarray(ivOffset, ciphertextOffset);
        const authTag = encryptedData.subarray(
          encryptedData.length - BACKUP_AES_AUTH_TAG_LENGTH,
        );
        const ciphertext = encryptedData.subarray(
          ciphertextOffset,
          encryptedData.length - BACKUP_AES_AUTH_TAG_LENGTH,
        );

        const key = deriveKeyFromPassword(password, salt);
        const decipher = createDecipheriv(BACKUP_AES_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        try {
          decryptedGzip = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        } catch {
          throw new BadRequestException(
            'Nieprawidłowe hasło szyfrowania kopii zapasowej lub uszkodzony plik.',
          );
        }
      } else {
        // Legacy V1 / server-key backup
        const minLength = BACKUP_AES_IV_LENGTH + BACKUP_AES_AUTH_TAG_LENGTH + 1;
        if (encryptedData.length < minLength) {
          throw new BadRequestException('Nieprawidłowy plik kopii zapasowej: plik jest zbyt krótki.');
        }
        const key = this.readEncryptionKey();
        const iv = encryptedData.subarray(0, BACKUP_AES_IV_LENGTH);
        const authTag = encryptedData.subarray(
          encryptedData.length - BACKUP_AES_AUTH_TAG_LENGTH,
        );
        const ciphertext = encryptedData.subarray(
          BACKUP_AES_IV_LENGTH,
          encryptedData.length - BACKUP_AES_AUTH_TAG_LENGTH,
        );
        const decipher = createDecipheriv(BACKUP_AES_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        try {
          decryptedGzip = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        } catch {
          throw new BadRequestException(
            'Nieprawidłowy klucz szyfrowania serwera lub uszkodzony plik kopii zapasowej.',
          );
        }
      }

      await this.runPgRestoreStream(
        Readable.from(decryptedGzip),
        createGunzip(),
        this.buildPgEnv(),
      );
      await this.recordRestore();
    } finally {
      this.isRestoreInProgress = false;
    }
  }

  /**
   * Creates an automated backup directly on the host/container volume.
   */
  async createAutoBackup(): Promise<BackupFileSummary> {
    if (this.isRestoreInProgress) {
      throw new ConflictException(
        'Nie można wykonać kopii zapasowej podczas przywracania bazy danych.',
      );
    }
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
   * Returns current auto-backup schedule configuration.
   */
  async getScheduleConfig(): Promise<AutoBackupScheduleConfig> {
    const metadata = await this.readMetadata();
    const config: AutoBackupScheduleConfig = {
      enabled: metadata.schedule?.enabled ?? BACKUP_DEFAULT_SCHEDULE_ENABLED,
      interval: (metadata.schedule?.interval as AutoBackupScheduleInterval) ?? BACKUP_DEFAULT_SCHEDULE_INTERVAL,
      customIntervalDays: metadata.schedule?.customIntervalDays ?? null,
      timeOfDay: metadata.schedule?.timeOfDay ?? BACKUP_DEFAULT_SCHEDULE_TIME,
    };
    config.nextRunAt = this.calculateNextRunAt(config, metadata.lastAutoBackupAt);
    return config;
  }

  /**
   * Updates auto-backup schedule configuration.
   */
  async updateScheduleConfig(
    dto: UpdateAutoBackupScheduleDto,
  ): Promise<AutoBackupScheduleConfig> {
    if (dto.interval === 'custom') {
      if (!dto.customIntervalDays || dto.customIntervalDays < 1 || dto.customIntervalDays > 365) {
        throw new BadRequestException(
          'customIntervalDays must be an integer between 1 and 365 when interval is "custom"',
        );
      }
    }

    await this.writeMetadata({
      schedule: {
        enabled: dto.enabled,
        interval: dto.interval,
        customIntervalDays: dto.interval === 'custom' ? dto.customIntervalDays : null,
        timeOfDay: dto.timeOfDay,
      },
    });
    this.logger.log(
      `Updated auto-backup schedule: enabled=${dto.enabled}, interval=${dto.interval}, customIntervalDays=${dto.customIntervalDays}, time=${dto.timeOfDay}`,
    );
    return this.getScheduleConfig();
  }

  /**
   * Calculates next scheduled execution timestamp.
   */
  calculateNextRunAt(
    config: AutoBackupScheduleConfig,
    lastAutoBackupAt: string | null,
    now: Date = new Date(),
  ): string | null {
    if (!config.enabled) {
      return null;
    }
    const [hourStr, minuteStr] = config.timeOfDay.split(':');
    const targetHour = parseInt(hourStr, 10);
    const targetMinute = parseInt(minuteStr, 10);

    const targetToday = new Date(now);
    targetToday.setHours(targetHour, targetMinute, 0, 0);

    if (!lastAutoBackupAt) {
      if (now.getTime() < targetToday.getTime()) {
        return targetToday.toISOString();
      }
      return new Date(targetToday.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }

    const intervalDays = this.getIntervalDays(config.interval, config.customIntervalDays);
    const lastBackupTime = new Date(lastAutoBackupAt).getTime();
    const candidate = new Date(lastBackupTime + intervalDays * 24 * 60 * 60 * 1000);
    candidate.setHours(targetHour, targetMinute, 0, 0);

    if (candidate.getTime() > now.getTime()) {
      return candidate.toISOString();
    }

    if (now.getTime() < targetToday.getTime()) {
      return targetToday.toISOString();
    }
    return new Date(targetToday.getTime() + 24 * 60 * 60 * 1000).toISOString();
  }

  /**
   * Determines whether an auto-backup is due to run at this exact moment.
   */
  async isAutoBackupDue(
    now: Date = new Date(),
    config?: AutoBackupScheduleConfig,
  ): Promise<boolean> {
    const activeConfig = config ?? (await this.getScheduleConfig());
    if (!activeConfig.enabled) {
      return false;
    }

    const [hourStr, minuteStr] = activeConfig.timeOfDay.split(':');
    const targetHour = parseInt(hourStr, 10);
    const targetMinute = parseInt(minuteStr, 10);

    if (now.getHours() !== targetHour || now.getMinutes() !== targetMinute) {
      return false;
    }

    const metadata = await this.readMetadata();
    if (!metadata.lastAutoBackupAt) {
      return true;
    }

    const lastDate = new Date(metadata.lastAutoBackupAt);
    if (
      activeConfig.interval === 'daily' ||
      (activeConfig.interval === 'custom' && activeConfig.customIntervalDays === 1)
    ) {
      const lastDay = lastDate.toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];
      return lastDay !== today;
    }

    const intervalDays = this.getIntervalDays(
      activeConfig.interval,
      activeConfig.customIntervalDays,
    );
    const diffMs = now.getTime() - lastDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= intervalDays - 0.2;
  }

  private getIntervalDays(
    interval: AutoBackupScheduleInterval,
    customIntervalDays?: number | null,
  ): number {
    switch (interval) {
      case 'daily':
        return 1;
      case 'every_3_days':
        return 3;
      case 'weekly':
        return 7;
      case 'every_2_weeks':
        return 14;
      case 'custom':
        return typeof customIntervalDays === 'number' && customIntervalDays >= 1
          ? Math.floor(customIntervalDays)
          : 1;
      default:
        return 1;
    }
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

    const schedule = await this.getScheduleConfig();

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
      schedule,
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

  public async readMetadata(): Promise<BackupMetadata> {
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
        schedule:
          data.schedule && typeof data.schedule === 'object'
            ? {
                enabled: Boolean(data.schedule.enabled),
                interval: (data.schedule.interval as AutoBackupScheduleInterval) || 'daily',
                customIntervalDays:
                  typeof data.schedule.customIntervalDays === 'number'
                    ? data.schedule.customIntervalDays
                    : null,
                timeOfDay: typeof data.schedule.timeOfDay === 'string' ? data.schedule.timeOfDay : '02:00',
              }
            : undefined,
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
      ...(updates.schedule
        ? {
            schedule: {
              ...current.schedule,
              ...updates.schedule,
            },
          }
        : {}),
    };
    const metaPath = path.join(storageDir, BACKUP_METADATA_FILENAME);
    const tempPath = `${metaPath}.${randomBytes(4).toString('hex')}.tmp`;
    await fsPromises.writeFile(tempPath, JSON.stringify(updated, null, 2), 'utf8');
    await fsPromises.rename(tempPath, metaPath);
  }

  private async runPgRestoreStream(
    sourceStream: Readable,
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
      pipeline(sourceStream, gunzip, child.stdin).catch((err: Error) => {
        this.logger.error(`Restore pipeline failed: ${err.message}`);
        if (child && !child.killed) {
          child.kill('SIGTERM');
        }
        if (err.message.includes('incorrect header check') || err.message.includes('zlib')) {
          reject(new BadRequestException('Błąd dekompresji kopii zapasowej (nieprawidłowy format).'));
          return;
        }
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
