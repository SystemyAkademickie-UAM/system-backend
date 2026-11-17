import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { SessionModule } from '../auth/session/session.module';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { AdminMaintenanceController } from './admin-maintenance-controller';
import { MaintenanceModeGuard } from './maintenance-mode-guard';
import { MaintenanceStatusModule } from './maintenance-status.module';
import { SystemStatusController } from './system-status-controller';

@Module({
  imports: [
    MaintenanceStatusModule,
    SessionModule,
    UserRolesModule,
  ],
  controllers: [
    AdminMaintenanceController,
    SystemStatusController,
  ],
  providers: [
    MaintenanceModeGuard,
    {
      provide: APP_GUARD,
      useExisting: MaintenanceModeGuard,
    },
  ],
  exports: [
    MaintenanceStatusModule,
    MaintenanceModeGuard,
  ],
})
export class MaintenanceModeModule {}
