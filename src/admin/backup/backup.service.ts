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
   * Creates an encrypted, compressed database backup.
   * Pipeline: pg_dump → gzip → AES-256-GCM encrypt → output buffer.
   */
  async createBackup(): Promise<Buffer> {
    const key = this.getEncryptionKey();
    const pgEnv = this.getPgEnv();

    const dumpBuffer = await this.runPgDump(pgEnv);

    return this.encryptBuffer(dumpBuffer, key);
  }

  /**
   * Restores a database from an encrypted backup file.
   * Pipeline: input buffer → AES-256-GCM decrypt → gunzip → pg_restore.
   */
  async restoreBackup(encryptedBuffer: Buffer): Promise<void> {
    const key = this.getEncryptionKey();
    const pgEnv = this.getPgEnv();

    const compressedDump = this.decryptBuffer(encryptedBuffer, key);

    await this.runPgRestore(compressedDump, pgEnv);
  }

  // ---------------------------------------------------------------------------
  // pg_dump / pg_restore
  // ---------------------------------------------------------------------------

  private runPgDump(pgEnv: Record<string, string>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
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

      const chunks: Buffer[] = [];
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      child.on('error', (err) => {
        this.logger.error(`pg_dump spawn error: ${err.message}`);
        reject(new InternalServerErrorException('Failed to start pg_dump. Is postgresql-client installed?'));
      });

      child.on('close', (code) => {
        if (code !== 0) {
          this.logger.error(`pg_dump exited with code ${code}: ${stderr}`);
          reject(new InternalServerErrorException('pg_dump failed'));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });
  }

  private async runPgRestore(compressedDump: Buffer, pgEnv: Record<string, string>): Promise<void> {
    // First decompress gzip → raw pg custom dump
    const rawDump = await this.gunzipBuffer(compressedDump);

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
        reject(new InternalServerErrorException('Failed to start pg_restore. Is postgresql-client installed?'));
      });

      child.on('close', (code) => {
        // pg_restore returns 1 for warnings (e.g. "role does not exist"), which is acceptable
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

      // Write dump to stdin
      child.stdin.write(rawDump);
      child.stdin.end();
    });
  }

  // ---------------------------------------------------------------------------
  // Encryption / Decryption (AES-256-GCM)
  // ---------------------------------------------------------------------------

  private encryptBuffer(plainData: Buffer, key: Buffer): Buffer {
    // First gzip compress
    return this.gzipThenEncrypt(plainData, key);
  }

  private gzipThenEncrypt(data: Buffer, key: Buffer): Buffer {
    // Synchronous gzip for simplicity (pg_dump output is typically manageable in memory)
    const { gzipSync } = require('node:zlib');
    const compressed: Buffer = gzipSync(data, { level: 9 });

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // File format: [IV (16)] [AuthTag (16)] [Encrypted data (...)]
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private decryptBuffer(encryptedData: Buffer, key: Buffer): Buffer {
    if (encryptedData.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      throw new InternalServerErrorException('Invalid backup file: too short');
    }

    const iv = encryptedData.subarray(0, IV_LENGTH);
    const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    try {
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      throw new InternalServerErrorException(
        'Failed to decrypt backup. The file may be corrupted or the encryption key is incorrect.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async gunzipBuffer(compressed: Buffer): Promise<Buffer> {
    const { gunzipSync } = require('node:zlib');
    try {
      return gunzipSync(compressed) as Buffer;
    } catch {
      throw new InternalServerErrorException('Failed to decompress backup data');
    }
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
