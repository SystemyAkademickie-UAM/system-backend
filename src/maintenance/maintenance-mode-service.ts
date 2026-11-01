import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MAINTENANCE_MODE_SINGLETON_ID } from '../constants/maintenance-constants';
import { MaintenanceModeEntity } from '../database/entities/maintenance-mode.entity';
import { UpdateMaintenanceModeDto } from './dto/update-maintenance-mode.dto';
import type { MaintenanceStatusResponse } from './maintenance-response-types';

/**
 * Domain service managing the platform technical break maintenance mode.
 */
@Injectable()
export class MaintenanceModeService {
  constructor(
    @InjectRepository(MaintenanceModeEntity)
    private readonly maintenanceRepository: Repository<MaintenanceModeEntity>,
  ) {}

  /**
   * Returns current maintenance mode status (singleton row).
   */
  async getMaintenanceStatus(): Promise<MaintenanceStatusResponse> {
    const row = await this.maintenanceRepository.findOne({
      where: { id: MAINTENANCE_MODE_SINGLETON_ID },
    });

    if (!row) {
      return {
        enabled: false,
        message: null,
        estimatedEndAt: null,
        updatedAt: null,
      };
    }

    return this.mapMaintenanceStatus(row);
  }

  /**
   * Updates maintenance mode state (trigger to enable/disable the technical break screen).
   */
  async updateMaintenanceStatus(
    dto: UpdateMaintenanceModeDto,
    superAdminUserId: number,
  ): Promise<MaintenanceStatusResponse> {
    const parsedEstimatedEndAt = this.parseEstimatedEndAt(dto.estimatedEndAt);
    const existing = await this.maintenanceRepository.findOne({
      where: { id: MAINTENANCE_MODE_SINGLETON_ID },
    });
    const message = dto.message !== undefined
      ? (dto.message?.trim() || null)
      : (existing?.message ?? null);
    const estimatedEndAt = parsedEstimatedEndAt !== undefined
      ? parsedEstimatedEndAt
      : (existing?.estimatedEndAt ?? null);

    const row = await this.maintenanceRepository.save({
      id: MAINTENANCE_MODE_SINGLETON_ID,
      isEnabled: dto.isEnabled,
      message,
      estimatedEndAt,
      updatedByUserId: superAdminUserId,
      updatedAt: new Date(),
    });

    return this.mapMaintenanceStatus(row);
  }

  /**
   * Fast check whether maintenance mode is currently active.
   */
  async isMaintenanceActive(): Promise<boolean> {
    const row = await this.maintenanceRepository.findOne({
      where: { id: MAINTENANCE_MODE_SINGLETON_ID },
      select: ['isEnabled'],
    });
    return row?.isEnabled ?? false;
  }

  private parseEstimatedEndAt(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value.trim().length === 0) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid estimatedEndAt date format');
    }
    return parsed;
  }

  private mapMaintenanceStatus(row: MaintenanceModeEntity): MaintenanceStatusResponse {
    return {
      enabled: row.isEnabled,
      message: row.message,
      estimatedEndAt: row.estimatedEndAt instanceof Date ? row.estimatedEndAt.toISOString() : null,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null,
    };
  }
}
