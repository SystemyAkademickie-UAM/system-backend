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
  BACKUP_V2_MAGIC_HEADER,
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
      expect(status.schedule).toBeDefined();
      expect(status.schedule.enabled).toBe(true);
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

  describe('Schedule management', () => {
    it('returns default schedule when none is stored', async () => {
      const schedule = await service.getScheduleConfig();
      expect(schedule.enabled).toBe(true);
      expect(schedule.interval).toBe('daily');
      expect(schedule.timeOfDay).toBe('02:00');
      expect(schedule.nextRunAt).toBeDefined();
    });

    it('saves and updates schedule configuration', async () => {
      const updated = await service.updateScheduleConfig({
        enabled: false,
        interval: 'weekly',
        timeOfDay: '04:30',
      });
      expect(updated.enabled).toBe(false);
      expect(updated.interval).toBe('weekly');
      expect(updated.timeOfDay).toBe('04:30');
      expect(updated.nextRunAt).toBeNull();

      const retrieved = await service.getScheduleConfig();
      expect(retrieved.enabled).toBe(false);
      expect(retrieved.interval).toBe('weekly');
    });

    it('saves custom interval schedule and validates customIntervalDays', async () => {
      await expect(
        service.updateScheduleConfig({
          enabled: true,
          interval: 'custom',
          customIntervalDays: 0,
          timeOfDay: '03:00',
        }),
      ).rejects.toThrow('customIntervalDays must be an integer between 1 and 365');

      const customUpdated = await service.updateScheduleConfig({
        enabled: true,
        interval: 'custom',
        customIntervalDays: 5,
        timeOfDay: '03:00',
      });
      expect(customUpdated.enabled).toBe(true);
      expect(customUpdated.interval).toBe('custom');
      expect(customUpdated.customIntervalDays).toBe(5);
      expect(customUpdated.nextRunAt).toBeDefined();
    });

    it('evaluates isAutoBackupDue correctly', async () => {
      // Disabled schedule -> false
      const scheduleDisabled = {
        enabled: false,
        interval: 'daily' as const,
        timeOfDay: '02:00',
      };
      expect(await service.isAutoBackupDue(new Date('2026-11-14T02:00:00Z'), scheduleDisabled)).toBe(false);

      // Wrong time -> false
      const scheduleDaily = {
        enabled: true,
        interval: 'daily' as const,
        timeOfDay: '02:00',
      };
      const nowWrongHour = new Date();
      nowWrongHour.setHours(15, 0, 0, 0);
      expect(await service.isAutoBackupDue(nowWrongHour, scheduleDaily)).toBe(false);

      // Right time and never backed up -> true
      const nowRightTime = new Date();
      nowRightTime.setHours(2, 0, 0, 0);
      expect(await service.isAutoBackupDue(nowRightTime, scheduleDaily)).toBe(true);
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

      const recentFilename = `${BACKUP_AUTO_FILE_PREFIX}2026-11-01T00-00-00-000Z${BACKUP_FILE_EXTENSION}`;
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
      await expect(service.getAutoBackupStream('backup-auto-invalid.enc')).rejects.toThrow(
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

    it('cleans up temporary file and leaves no partial backup if backup stream fails', async () => {
      const failingStream = new Readable({
        read() {
          this.destroy(new Error('Simulated dump failure'));
        },
      });
      jest.spyOn(service, 'createBackupStream').mockResolvedValue(failingStream);

      await expect(service.createAutoBackup()).rejects.toThrow('Simulated dump failure');

      const files = await fs.promises.readdir(tempDir);
      const encOrTmpFiles = files.filter((f) => f.endsWith('.enc') || f.endsWith('.tmp'));
      expect(encOrTmpFiles.length).toBe(0);
    });

    it('throws ConflictException if an auto backup is already in progress', async () => {
      let finishStream: () => void = () => {};
      const delayedStream = new Readable({
        read() {},
      });

      jest.spyOn(service, 'createBackupStream').mockImplementation(async () => {
        setTimeout(() => {
          delayedStream.push(null);
          finishStream();
        }, 100);
        return delayedStream;
      });

      const firstCall = service.createAutoBackup();
      await expect(service.createAutoBackup()).rejects.toThrow('Automated backup is already in progress');

      await firstCall;
    });
  });

  describe('Password-protected backups', () => {
    it('rejects createBackupStream when password is shorter than 8 chars', async () => {
      await expect(service.createBackupStream({ password: 'short' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects restoreBackup for V2 file without password', async () => {
      const fakeV2 = Buffer.concat([BACKUP_V2_MAGIC_HEADER, Buffer.alloc(60, 1)]);
      await expect(service.restoreBackup(fakeV2)).rejects.toThrow(/zabezpieczona hasłem/);
    });
  });
});
