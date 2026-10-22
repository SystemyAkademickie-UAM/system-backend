import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SessionModule } from '../auth/session/session.module';
import { MaintenanceModeEntity } from '../database/entities/maintenance-mode.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { AdminMaintenanceController } from './admin-maintenance-controller';
import { MaintenanceModeGuard } from './maintenance-mode-guard';
import { MaintenanceModeService } from './maintenance-mode-service';
import { SystemStatusController } from './system-status-controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaintenanceModeEntity]),
    SessionModule,
    UserRolesModule,
  ],
  controllers: [
    AdminMaintenanceController,
    SystemStatusController,
  ],
  providers: [
    MaintenanceModeService,
    MaintenanceModeGuard,
    {
      provide: APP_GUARD,
      useExisting: MaintenanceModeGuard,
    },
  ],
  exports: [
    MaintenanceModeService,
    MaintenanceModeGuard,
  ],
})
export class MaintenanceModeModule {}
