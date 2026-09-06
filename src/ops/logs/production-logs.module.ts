import { Module } from '@nestjs/common';

import { AdminAccessService } from '../../admin/admin-access.service';
import { SessionModule } from '../../auth/session/session.module';
import { UserRolesModule } from '../../user-roles/user-roles-module';
import { ClientLogsController } from './client-logs.controller';
import { LogArchiveSchedulerService } from './log-archive-scheduler.service';
import { LogStoreService } from './log-store.service';
import { ProductionLogsController } from './production-logs.controller';
import { ProductionLogsService } from './production-logs.service';

@Module({
  imports: [SessionModule, UserRolesModule],
  controllers: [ProductionLogsController, ClientLogsController],
  providers: [
    LogStoreService,
    ProductionLogsService,
    LogArchiveSchedulerService,
    AdminAccessService,
  ],
  exports: [LogStoreService],
})
export class ProductionLogsModule {}
