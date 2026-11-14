import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { BackupService } from './backup.service';

/**
 * Automates dynamic database backups and retention cleanup on the host volume
 * based on the superadmin-configured schedule.
 */
@Injectable()
export class BackupSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(BackupSchedulerService.name);

  constructor(private readonly backupService: BackupService) {}

  async onModuleInit(): Promise<void> {
    try {
      const purgeResult = await this.backupService.purgeOldAutoBackups();
      if (purgeResult.purgedCount > 0) {
        this.logger.log(
          `Startup backup retention cleanup: purged ${purgeResult.purgedCount} expired backup(s) (${purgeResult.freedBytes} bytes freed)`,
        );
      }
      const schedule = await this.backupService.getScheduleConfig();
      if (schedule.enabled) {
        this.logger.log(
          `Auto-backup scheduler initialized: interval=${schedule.interval}, time=${schedule.timeOfDay}, nextRunAt=${schedule.nextRunAt ?? 'unknown'}`,
        );
      } else {
        this.logger.log('Auto-backup scheduler initialized: currently DISABLED by superadmin');
      }
    } catch (err: unknown) {
      this.logger.warn(`Startup backup scheduler init error: ${String(err)}`);
    }
  }

  /**
   * Evaluates the active schedule every minute and triggers auto-backup when due.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledCheck(): Promise<void> {
    try {
      const now = new Date();
      const isDue = await this.backupService.isAutoBackupDue(now);
      if (!isDue) {
        return;
      }

      this.logger.log('Scheduled automated database backup is due. Starting dump...');
      const summary = await this.backupService.createAutoBackup();
      this.logger.log(
        `Scheduled automated backup finished: ${summary.filename} (${summary.sizeBytes} bytes)`,
      );

      const purgeResult = await this.backupService.purgeOldAutoBackups();
      if (purgeResult.purgedCount > 0) {
        this.logger.log(
          `Backup retention: purged ${purgeResult.purgedCount} expired backup(s) (${purgeResult.freedBytes} bytes freed)`,
        );
      }
    } catch (err: unknown) {
      this.logger.error(`Scheduled automated backup failed: ${String(err)}`);
    }
  }
}
