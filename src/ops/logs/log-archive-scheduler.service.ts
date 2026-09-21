import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { LogStoreService } from './log-store.service';

/**
 * Gzip closed days, zip closed months, delete files past TTL.
 */
@Injectable()
export class LogArchiveSchedulerService {
  private readonly logger = new Logger(LogArchiveSchedulerService.name);

  constructor(private readonly logStore: LogStoreService) {}

  @Cron(CronExpression.EVERY_HOUR)
  handleArchiveAndPurge(): void {
    try {
      const archived = this.logStore.archiveClosedDays();
      const packed = this.logStore.packClosedMonths();
      const removed = this.logStore.purgeExpired();
      if (archived.length === 0 && packed.length === 0 && removed.length === 0) {
        return;
      }
      this.logger.log(
        `Log archive: gzipped ${archived.length} day(s), zipped ${packed.length} month(s), purged ${removed.length} expired file(s)`,
      );
    } catch (err: unknown) {
      this.logger.error(`Log archive failed: ${String(err)}`);
    }
  }
}
