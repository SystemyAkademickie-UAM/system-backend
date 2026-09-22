import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { PassThrough, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Transform } from 'node:stream';
import { createGunzip, createGzip } from 'node:zlib';

import {
  BACKUP_AES_ALGORITHM,
  BACKUP_AES_AUTH_TAG_LENGTH,
  BACKUP_AES_IV_LENGTH,
  BACKUP_ENCRYPTION_KEY_ENV,
  BACKUP_GZIP_LEVEL,
  BACKUP_PG_RESTORE_WARNING_EXIT_CODE,
} from '../../constants/backup-constants';
import { resolvePostgresSslOption } from '../../database/postgres-ssl.config';
import { deriveBackupEncryptionKey } from './backup-crypto';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

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
    child.on('error', (err: Error) => {
      this.logger.error(`pg_dump spawn failed: ${err.message}`);
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (code !== 0) {
        this.logger.error(`pg_dump exited with code ${code}: ${stderr}`);
      }
    });
    if (child.stdout === null) {
      throw new InternalServerErrorException('Failed to start pg_dump');
    }
    const gzip = createGzip({ level: BACKUP_GZIP_LEVEL });
    const iv = randomBytes(BACKUP_AES_IV_LENGTH);
    const cipher = createCipheriv(BACKUP_AES_ALGORITHM, key, iv);
    const passThrough = new PassThrough();
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
