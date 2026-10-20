import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { MaintenanceModeService } from './maintenance-mode-service';
import type {
  MaintenanceStatusResponse,
  SystemStatusResponse,
} from './maintenance-response-types';

/**
 * Public controller providing operational system status and maintenance mode state.
 */
@ApiTags('System status')
@Controller('system')
export class SystemStatusController {
  constructor(private readonly maintenanceService: MaintenanceModeService) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get operational system status including maintenance mode flag' })
  @ApiOkResponse({ description: 'System status and maintenance configuration' })
  async getStatus(): Promise<SystemStatusResponse> {
    const maintenance = await this.maintenanceService.getMaintenanceStatus();
    return {
      maintenance,
      serverTime: new Date().toISOString(),
    };
  }

  @Get('maintenance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get technical break maintenance mode state (public probe)' })
  @ApiOkResponse({ description: 'Maintenance mode probe' })
  async getMaintenance(): Promise<MaintenanceStatusResponse> {
    return this.maintenanceService.getMaintenanceStatus();
  }
}
