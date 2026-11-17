import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MaintenanceModeEntity } from '../database/entities/maintenance-mode.entity';
import { MaintenanceModeService } from './maintenance-mode-service';

/**
 * Provides MaintenanceModeService without registering global guards or controllers,
 * allowing feature modules like LoginModule to inspect maintenance state safely.
 */
@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceModeEntity])],
  providers: [MaintenanceModeService],
  exports: [MaintenanceModeService],
})
export class MaintenanceStatusModule {}
