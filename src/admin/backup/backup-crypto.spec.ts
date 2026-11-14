import {
  BACKUP_ENCRYPTION_KEY_MIN_LENGTH,
  BACKUP_V2_MAGIC_HEADER,
} from '../../constants/backup-constants';
import {
  deriveBackupEncryptionKey,
  deriveKeyFromPassword,
  isV2Backup,
} from './backup-crypto';

describe('backup-crypto', () => {
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

  describe('deriveKeyFromPassword', () => {
    const salt = Buffer.alloc(16, 1);
    const mockPasswordAlpha = ['mock', 'pass', 'alpha', 'key'].join('-');
    const mockPasswordBeta = ['mock', 'pass', 'beta', 'key'].join('-');

    it('returns 32 bytes for a valid password and salt', () => {
      const key = deriveKeyFromPassword(mockPasswordAlpha, salt);
      expect(key.length).toBe(32);
    });

    it('is deterministic for same password and salt', () => {
      const key1 = deriveKeyFromPassword(mockPasswordAlpha, salt);
      const key2 = deriveKeyFromPassword(mockPasswordAlpha, salt);
      expect(key1.equals(key2)).toBe(true);
    });

    it('produces different keys for different salts', () => {
      const otherSalt = Buffer.alloc(16, 2);
      const key1 = deriveKeyFromPassword(mockPasswordAlpha, salt);
      const key2 = deriveKeyFromPassword(mockPasswordAlpha, otherSalt);
      expect(key1.equals(key2)).toBe(false);
    });

    it('produces different keys for different passwords', () => {
      const key1 = deriveKeyFromPassword(mockPasswordAlpha, salt);
      const key2 = deriveKeyFromPassword(mockPasswordBeta, salt);
      expect(key1.equals(key2)).toBe(false);
    });

    it('rejects passwords shorter than 8 characters', () => {
      expect(() => deriveKeyFromPassword('short', salt)).toThrow(/at least 8/);
    });
  });

  describe('isV2Backup', () => {
    it('returns true when buffer starts with V2 magic header', () => {
      const buf = Buffer.concat([BACKUP_V2_MAGIC_HEADER, Buffer.from('extra-data')]);
      expect(isV2Backup(buf)).toBe(true);
    });

    it('returns false when buffer does not start with V2 magic header', () => {
      const buf = Buffer.from('legacy-backup-data');
      expect(isV2Backup(buf)).toBe(false);
    });

    it('returns false for small or empty buffer', () => {
      expect(isV2Backup(Buffer.alloc(0))).toBe(false);
      expect(isV2Backup(Buffer.from('MAQ'))).toBe(false);
    });
  });
});
