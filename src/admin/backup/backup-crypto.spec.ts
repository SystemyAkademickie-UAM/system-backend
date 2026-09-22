import { BACKUP_ENCRYPTION_KEY_MIN_LENGTH } from '../../constants/backup-constants';
import { deriveBackupEncryptionKey } from './backup-crypto';

describe('deriveBackupEncryptionKey', () => {
  const inputKey = 'a'.repeat(BACKUP_ENCRYPTION_KEY_MIN_LENGTH);

  it('returns 32 bytes for a valid secret', () => {
    const actualKey = deriveBackupEncryptionKey(inputKey);
    expect(actualKey.length).toBe(32);
  });

  it('is stable for the same secret', () => {
    const firstKey = deriveBackupEncryptionKey(inputKey);
    const secondKey = deriveBackupEncryptionKey(inputKey);
    expect(firstKey.equals(secondKey)).toBe(true);
  });

  it('rejects short secrets', () => {
    expect(() => deriveBackupEncryptionKey('short')).toThrow(/at least/);
  });
});
