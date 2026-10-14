import { createHash } from 'node:crypto';

import { BACKUP_ENCRYPTION_KEY_MIN_LENGTH } from '../../constants/backup-constants';

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
