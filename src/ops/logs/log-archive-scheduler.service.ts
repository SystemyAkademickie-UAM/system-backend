import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { LogStoreService } from './log-store.service';

/**
 * Gzip closed 5-minute slots and delete files past TTL.
 */
@Injectable()
export class LogArchiveSchedulerService {
  private readonly logger = new Logger(LogArchiveSchedulerService.name);

  constructor(private readonly logStore: LogStoreService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  handleArchiveAndPurge(): void {
    try {
      this.logger.log('Log slot tick');
      const archived = this.logStore.archiveClosedDays();
      const removed = this.logStore.purgeExpired();
      if (archived.length === 0 && removed.length === 0) {
        return;
      }
      this.logger.log(
        `Log archive: gziped ${archived.length} slot(s), purged ${removed.length} expired file(s)`,
      );
    } catch (err: unknown) {
      this.logger.error(`Log archive failed: ${String(err)}`);
    }
  }
}
