import { BackupSchedulerService } from './backup-scheduler.service';
import type { AutoBackupScheduleConfig, BackupFileSummary } from './backup-response-types';
import { BackupService } from './backup.service';

describe('BackupSchedulerService', () => {
  let service: BackupSchedulerService;
  let backupService: jest.Mocked<BackupService>;

  beforeEach(() => {
    backupService = {
      purgeOldAutoBackups: jest.fn().mockResolvedValue({ purgedCount: 2, freedBytes: 1024 }),
      createAutoBackup: jest.fn().mockResolvedValue({
        filename: 'backup-auto-test.enc',
        createdAt: '2026-11-02T02:00:00.000Z',
        sizeBytes: 2048,
      } as BackupFileSummary),
      getScheduleConfig: jest.fn().mockResolvedValue({
        enabled: true,
        interval: 'daily',
        timeOfDay: '02:00',
        nextRunAt: '2026-11-15T02:00:00.000Z',
      } as AutoBackupScheduleConfig),
      isAutoBackupDue: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<BackupService>;

    service = new BackupSchedulerService(backupService);
  });

  describe('onModuleInit', () => {
    it('runs retention purge on module initialization and logs schedule info', async () => {
      await service.onModuleInit();
      expect(backupService.purgeOldAutoBackups).toHaveBeenCalledTimes(1);
      expect(backupService.getScheduleConfig).toHaveBeenCalledTimes(1);
    });

    it('handles error in purge gracefully without throwing', async () => {
      backupService.purgeOldAutoBackups.mockRejectedValue(new Error('Disk error'));
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('handleScheduledCheck', () => {
    it('creates auto-backup and triggers retention cleanup when due', async () => {
      backupService.isAutoBackupDue.mockResolvedValue(true);
      await service.handleScheduledCheck();
      expect(backupService.createAutoBackup).toHaveBeenCalledTimes(1);
      expect(backupService.purgeOldAutoBackups).toHaveBeenCalledTimes(1);
    });

    it('does not create auto-backup when not due', async () => {
      backupService.isAutoBackupDue.mockResolvedValue(false);
      await service.handleScheduledCheck();
      expect(backupService.createAutoBackup).not.toHaveBeenCalled();
      expect(backupService.purgeOldAutoBackups).not.toHaveBeenCalled();
    });

    it('handles backup failure gracefully without crashing', async () => {
      backupService.isAutoBackupDue.mockResolvedValue(true);
      backupService.createAutoBackup.mockRejectedValue(new Error('pg_dump failure'));
      await expect(service.handleScheduledCheck()).resolves.not.toThrow();
    });
  });
});
