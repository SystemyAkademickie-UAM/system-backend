import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createGzip, createGunzip } from 'node:zlib';
import { PassThrough, Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { resolvePostgresSslOption } from '../../database/postgres-ssl.config';

/** Header layout: 16-byte IV + 16-byte auth tag placeholder (written after encryption). */
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = 'aes-256-gcm';
const MIN_KEY_LENGTH = 32;

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Creates an encrypted, compressed database backup stream.
   * Pipeline: pg_dump → gzip → AES-256-GCM encrypt → output stream.
   * File format: [IV (16)] [Encrypted data (...)] [AuthTag (16)]
   */
  async createBackupStream(): Promise<Readable> {
    const key = this.getEncryptionKey();
    const pgEnv = this.getPgEnv();

    const args = [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      `--dbname=${pgEnv.PGDATABASE}`,
    ];

    const child = spawn('pg_dump', args, {
      env: { ...process.env, ...pgEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on('close', (code) => {
      if (code !== 0) {
        this.logger.error(`pg_dump exited with code ${code}: ${stderr}`);
      }
    });

    const gzip = createGzip({ level: 9 });
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const passThrough = new PassThrough();
    passThrough.write(iv); // write IV at the beginning

    // Start pipeline
    pipeline(
      child.stdout,
      gzip,
      cipher,
      async function* (source) {
        for await (const chunk of source) {
          yield chunk;
        }
        // Yield auth tag at the very end
        yield cipher.getAuthTag();
      },
      passThrough,
    ).catch((err) => {
      this.logger.error('Backup export pipeline failed', err);
      passThrough.destroy(err);
    });

    return passThrough;
  }

  /**
   * Restores a database from an encrypted backup file buffer.
   * Pipeline: decipher → gunzip → pg_restore.
   */
  async restoreBackup(encryptedData: Buffer): Promise<void> {
    if (encryptedData.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      throw new InternalServerErrorException('Invalid backup file: too short');
    }

    const key = this.getEncryptionKey();
    const pgEnv = this.getPgEnv();

    const iv = encryptedData.subarray(0, IV_LENGTH);
    const authTag = encryptedData.subarray(encryptedData.length - AUTH_TAG_LENGTH);
    const ciphertext = encryptedData.subarray(IV_LENGTH, encryptedData.length - AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const gunzip = createGunzip();

    await this.runPgRestoreStream(Readable.from(ciphertext), decipher, gunzip, pgEnv);
  }

  private async runPgRestoreStream(
    sourceStream: Readable,
    decipher: import('stream').Transform,
    gunzip: import('stream').Transform,
    pgEnv: Record<string, string>,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '--format=custom',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        `--dbname=${pgEnv.PGDATABASE}`,
      ];

      const child = spawn('pg_restore', args, {
        env: { ...process.env, ...pgEnv },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      child.on('error', (err) => {
        this.logger.error(`pg_restore spawn error: ${err.message}`);
        reject(new InternalServerErrorException('Failed to start pg_restore'));
      });

      child.on('close', (code) => {
        if (code !== 0 && code !== 1) {
          this.logger.error(`pg_restore exited with code ${code}: ${stderr}`);
          reject(new InternalServerErrorException('pg_restore failed'));
          return;
        }
        if (stderr) {
          this.logger.warn(`pg_restore warnings: ${stderr}`);
        }
        resolve();
      });

      pipeline(sourceStream, decipher, gunzip, child.stdin).catch((err) => {
        this.logger.error('Restore pipeline failed', err);
        reject(new InternalServerErrorException('Restore pipeline failed'));
      });
    });
  }

  private getEncryptionKey(): Buffer {
    const rawKey = this.configService.get<string>('BACKUP_ENCRYPTION_KEY', '');
    if (!rawKey || rawKey.trim().length < MIN_KEY_LENGTH) {
      throw new InternalServerErrorException(
        `BACKUP_ENCRYPTION_KEY must be at least ${MIN_KEY_LENGTH} characters`,
      );
    }
    // Derive a 32-byte key by taking first 32 bytes of the raw string (UTF-8)
    // For production, consider using a proper KDF (PBKDF2/scrypt), but raw key is acceptable
    // when the user controls the key length and entropy.
    const keyBuffer = Buffer.from(rawKey.trim(), 'utf8');
    if (keyBuffer.length < 32) {
      throw new InternalServerErrorException('BACKUP_ENCRYPTION_KEY must yield at least 32 bytes');
    }
    return keyBuffer.subarray(0, 32);
  }

  private getPgEnv(): Record<string, string> {
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
