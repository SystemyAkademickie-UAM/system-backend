import { BackupSchedulerService } from './backup-scheduler.service';
import type { BackupFileSummary } from './backup-response-types';
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
    } as unknown as jest.Mocked<BackupService>;

    service = new BackupSchedulerService(backupService);
  });

  describe('onModuleInit', () => {
    it('runs retention purge on module initialization', async () => {
      await service.onModuleInit();
      expect(backupService.purgeOldAutoBackups).toHaveBeenCalledTimes(1);
    });

    it('handles error in purge gracefully without throwing', async () => {
      backupService.purgeOldAutoBackups.mockRejectedValue(new Error('Disk error'));
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('handleDailyAutoBackup', () => {
    it('creates auto-backup and triggers retention cleanup', async () => {
      await service.handleDailyAutoBackup();
      expect(backupService.createAutoBackup).toHaveBeenCalledTimes(1);
      expect(backupService.purgeOldAutoBackups).toHaveBeenCalledTimes(1);
    });

    it('handles backup failure gracefully without crashing', async () => {
      backupService.createAutoBackup.mockRejectedValue(new Error('pg_dump failure'));
      await expect(service.handleDailyAutoBackup()).resolves.not.toThrow();
    });
  });
});
