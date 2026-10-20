import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { SessionService } from '../auth/session/session.service';
import { SUPER_ROLE_NAME } from '../constants/role-name-constants';
import { MAQ_SESSION_COOKIE_NAME } from '../constants/session-constants';
import { UserRolesService } from '../user-roles/user-roles-service';
import { UpdateMaintenanceModeDto } from './dto/update-maintenance-mode.dto';
import { MaintenanceModeService } from './maintenance-mode-service';
import type { MaintenanceStatusResponse } from './maintenance-response-types';

/**
 * Controller for super-administrators controlling the system maintenance mode trigger.
 */
@ApiTags('Admin maintenance')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller('admin/maintenance')
export class AdminMaintenanceController {
  constructor(
    private readonly maintenanceService: MaintenanceModeService,
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current maintenance mode configuration (super admin only)' })
  @ApiOkResponse({ description: 'Maintenance mode status' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async getStatus(@Req() req: Request): Promise<MaintenanceStatusResponse> {
    await this.resolveSuperAdminUserId(req);
    return this.maintenanceService.getMaintenanceStatus();
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle or update maintenance mode (super admin trigger)' })
  @ApiOkResponse({ description: 'Updated maintenance mode status' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async updateStatus(
    @Req() req: Request,
    @Body() dto: UpdateMaintenanceModeDto,
  ): Promise<MaintenanceStatusResponse> {
    const superAdminUserId = await this.resolveSuperAdminUserId(req);
    return this.maintenanceService.updateMaintenanceStatus(dto, superAdminUserId);
  }

  private async resolveSuperAdminUserId(req: Request): Promise<number> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (subject === null) {
      throw new UnauthorizedException('Unauthorized');
    }
    const isSuperAdmin = await this.userRolesService.userHasRole(
      subject.userId,
      SUPER_ROLE_NAME,
    );
    if (!isSuperAdmin) {
      throw new ForbiddenException('Forbidden: Requires super role');
    }
    return subject.userId;
  }
}
