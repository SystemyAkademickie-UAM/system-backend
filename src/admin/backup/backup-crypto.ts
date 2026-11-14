import { createHash, pbkdf2Sync } from 'node:crypto';

import {
  BACKUP_ENCRYPTION_KEY_MIN_LENGTH,
  BACKUP_PASSWORD_MIN_LENGTH,
  BACKUP_PBKDF2_DIGEST,
  BACKUP_PBKDF2_ITERATIONS,
  BACKUP_PBKDF2_KEY_LENGTH,
  BACKUP_V2_MAGIC_HEADER,
} from '../../constants/backup-constants';

/**
 * Derives a 32-byte AES key from the configured backup secret (SHA-256).
 */
export function deriveBackupEncryptionKey(rawKey: string): Buffer {
  const trimmed = rawKey.trim();
  if (trimmed.length < BACKUP_ENCRYPTION_KEY_MIN_LENGTH) {
    throw new Error(
      `BACKUP_ENCRYPTION_KEY must be at least ${BACKUP_ENCRYPTION_KEY_MIN_LENGTH} characters`,
    );
  }
  return createHash('sha256').update(trimmed, 'utf8').digest();
}

/**
 * Derives a 32-byte AES key from a user-supplied password and salt using PBKDF2.
 */
export function deriveKeyFromPassword(password: string, salt: Buffer): Buffer {
  const trimmed = typeof password === 'string' ? password.trim() : '';
  if (trimmed.length < BACKUP_PASSWORD_MIN_LENGTH) {
    throw new Error(
      `Password must be at least ${BACKUP_PASSWORD_MIN_LENGTH} characters`,
    );
  }
  return pbkdf2Sync(
    trimmed,
    salt,
    BACKUP_PBKDF2_ITERATIONS,
    BACKUP_PBKDF2_KEY_LENGTH,
    BACKUP_PBKDF2_DIGEST,
  );
}

/**
 * Checks if the backup payload starts with the V2 password-encrypted magic header.
 */
export function isV2Backup(buffer: Buffer): boolean {
  if (!buffer || buffer.length < BACKUP_V2_MAGIC_HEADER.length) {
    return false;
  }
  return buffer.subarray(0, BACKUP_V2_MAGIC_HEADER.length).equals(BACKUP_V2_MAGIC_HEADER);
}
