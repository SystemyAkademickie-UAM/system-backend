import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { AdminAccessService } from '../../admin/admin-access.service';
import { SessionModule } from '../../auth/session/session.module';
import { UserRolesModule } from '../../user-roles/user-roles-module';
import { ClientLogsController } from './client-logs.controller';
import { HttpTrafficLoggerMiddleware } from './http-traffic-logger.middleware';
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
    HttpTrafficLoggerMiddleware,
  ],
  exports: [LogStoreService, HttpTrafficLoggerMiddleware],
})
export class ProductionLogsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpTrafficLoggerMiddleware).forRoutes('*');
  }
}
