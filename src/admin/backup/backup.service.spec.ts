import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';

import {
  BACKUP_AUTO_FILE_PREFIX,
  BACKUP_DEFAULT_MANUAL_WARNING_DAYS,
  BACKUP_FILE_EXTENSION,
  BACKUP_MANUAL_WARNING_DAYS_ENV,
  BACKUP_METADATA_FILENAME,
  BACKUP_RETENTION_DAYS_ENV,
  BACKUP_STORAGE_DIR_ENV,
} from '../../constants/backup-constants';
import { BackupService } from './backup.service';

describe('BackupService', () => {
  let service: BackupService;
  let tempDir: string;
  let configService: ConfigService;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'maq-backup-test-'));
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === BACKUP_STORAGE_DIR_ENV) {
          return tempDir;
        }
        if (key === BACKUP_RETENTION_DAYS_ENV) {
          return '14';
        }
        if (key === BACKUP_MANUAL_WARNING_DAYS_ENV) {
          return '7';
        }
        if (key === 'BACKUP_ENCRYPTION_KEY') {
          return '01234567890123456789012345678901';
        }
        return defaultValue;
      }),
    } as unknown as ConfigService;

    service = new BackupService(configService);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('getBackupStatus', () => {
    it('reports manual backup overdue when no manual backup has been performed', async () => {
      const status = await service.getBackupStatus();
      expect(status.lastManualBackupAt).toBeNull();
      expect(status.isManualBackupOverdue).toBe(true);
      expect(status.daysSinceLastManualBackup).toBeNull();
      expect(status.manualBackupThresholdDays).toBe(BACKUP_DEFAULT_MANUAL_WARNING_DAYS);
      expect(status.autoBackupsCount).toBe(0);
    });

    it('reports manual backup overdue when last manual backup was 10 days ago', async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const metaPath = path.join(tempDir, BACKUP_METADATA_FILENAME);
      await fs.promises.writeFile(
        metaPath,
        JSON.stringify({ lastManualBackupAt: tenDaysAgo }),
        'utf8',
      );

      const status = await service.getBackupStatus();
      expect(status.lastManualBackupAt).toBe(tenDaysAgo);
      expect(status.isManualBackupOverdue).toBe(true);
      expect(status.daysSinceLastManualBackup).toBeGreaterThanOrEqual(9);
    });

    it('reports manual backup up-to-date when performed 2 days ago', async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const metaPath = path.join(tempDir, BACKUP_METADATA_FILENAME);
      await fs.promises.writeFile(
        metaPath,
        JSON.stringify({ lastManualBackupAt: twoDaysAgo }),
        'utf8',
      );

      const status = await service.getBackupStatus();
      expect(status.lastManualBackupAt).toBe(twoDaysAgo);
      expect(status.isManualBackupOverdue).toBe(false);
      expect(status.daysSinceLastManualBackup).toBe(2);
    });

    it('lists automated backups present on disk sorted newest first', async () => {
      const fileOld = `${BACKUP_AUTO_FILE_PREFIX}2026-10-01T10-00-00-000Z${BACKUP_FILE_EXTENSION}`;
      const fileNew = `${BACKUP_AUTO_FILE_PREFIX}2026-10-02T10-00-00-000Z${BACKUP_FILE_EXTENSION}`;

      await fs.promises.writeFile(path.join(tempDir, fileOld), 'old-data');
      await fs.promises.writeFile(path.join(tempDir, fileNew), 'new-data-with-more-bytes');

      const status = await service.getBackupStatus();
      expect(status.autoBackupsCount).toBe(2);
      expect(status.totalStorageSizeBytes).toBe('old-data'.length + 'new-data-with-more-bytes'.length);
      expect(status.autoBackups.length).toBe(2);
    });
  });

  describe('recordManualBackup and recordRestore', () => {
    it('saves lastManualBackupAt to metadata file', async () => {
      await service.recordManualBackup();
      const status = await service.getBackupStatus();
      expect(status.lastManualBackupAt).not.toBeNull();
      expect(status.isManualBackupOverdue).toBe(false);
    });

    it('saves lastRestoreAt to metadata file', async () => {
      await service.recordRestore();
      const metaPath = path.join(tempDir, BACKUP_METADATA_FILENAME);
      const content = JSON.parse(await fs.promises.readFile(metaPath, 'utf8'));
      expect(content.lastRestoreAt).not.toBeNull();
    });
  });

  describe('purgeOldAutoBackups', () => {
    it('deletes backup files older than retention period', async () => {
      const oldFilename = `${BACKUP_AUTO_FILE_PREFIX}2026-01-01T00-00-00-000Z${BACKUP_FILE_EXTENSION}`;
      const oldPath = path.join(tempDir, oldFilename);
      await fs.promises.writeFile(oldPath, 'dummy data');

      // Set mtime to 30 days ago
      const pastTime = (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000;
      await fs.promises.utimes(oldPath, pastTime, pastTime);

      const recentFilename = `${BACKUP_AUTO_FILE_PREFIX}recent${BACKUP_FILE_EXTENSION}`;
      const recentPath = path.join(tempDir, recentFilename);
      await fs.promises.writeFile(recentPath, 'recent data');

      const purgeResult = await service.purgeOldAutoBackups();
      expect(purgeResult.purgedCount).toBe(1);
      expect(purgeResult.freedBytes).toBe('dummy data'.length);

      expect(fs.existsSync(oldPath)).toBe(false);
      expect(fs.existsSync(recentPath)).toBe(true);
    });
  });

  describe('getAutoBackupStream', () => {
    it('rejects path traversal attempts', async () => {
      await expect(service.getAutoBackupStream('../secret.txt')).rejects.toThrow(BadRequestException);
      await expect(service.getAutoBackupStream('backup-auto-../../etc/passwd.enc')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects filenames that do not match the expected pattern', async () => {
      await expect(service.getAutoBackupStream('malicious.sh')).rejects.toThrow(BadRequestException);
      await expect(service.getAutoBackupStream('backup-manual-123.enc')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when file does not exist', async () => {
      await expect(
        service.getAutoBackupStream('backup-auto-2026-11-02T12-00-00-000Z.enc'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns stream for valid existing auto-backup', async () => {
      const validName = 'backup-auto-2026-11-02T12-00-00-000Z.enc';
      await fs.promises.writeFile(path.join(tempDir, validName), 'sample-backup-content');

      const result = await service.getAutoBackupStream(validName);
      expect(result.sizeBytes).toBe('sample-backup-content'.length);
      expect(result.stream).toBeDefined();
    });
  });

  describe('createAutoBackup', () => {
    it('creates an auto-backup file on disk and updates metadata', async () => {
      jest.spyOn(service, 'createBackupStream').mockResolvedValue(Readable.from(['chunk1', 'chunk2']));

      const summary = await service.createAutoBackup();
      expect(summary.filename).toMatch(/^backup-auto-.*\.enc$/);
      expect(summary.sizeBytes).toBe('chunk1chunk2'.length);

      const filePath = path.join(tempDir, summary.filename);
      expect(fs.existsSync(filePath)).toBe(true);

      const status = await service.getBackupStatus();
      expect(status.lastAutoBackupAt).toBe(summary.createdAt);
      expect(status.autoBackupsCount).toBe(1);
    });
  });
});
