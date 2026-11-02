import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { BackupService } from './backup.service';

/**
 * Automates daily database backups and retention cleanup on the host volume.
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
    } catch (err: unknown) {
      this.logger.warn(`Startup backup retention cleanup error: ${String(err)}`);
    }
  }

  /**
   * Executes automated backup every day at 02:00 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyAutoBackup(): Promise<void> {
    try {
      this.logger.log('Starting scheduled automated database backup...');
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
