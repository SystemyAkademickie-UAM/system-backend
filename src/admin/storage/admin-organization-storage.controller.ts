import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../../constants/session-constants';
import { AdminOrganizationStorageService } from './admin-organization-storage.service';
import {
  OrganizationDashboardDetailDto,
  OrganizationStorageDetailDto,
} from './dto/admin-organization-storage.dto';

@ApiTags('Admin organizations')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller('admin/organizations/:organizationId')
export class AdminOrganizationStorageController {
  constructor(
    private readonly storageService: AdminOrganizationStorageService,
  ) {}

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get organization overview and dashboard metrics (super or organization administrator)',
  })
  @ApiOkResponse({
    description: 'Organization profile, account stats, group stats, and storage usage',
    type: OrganizationDashboardDetailDto,
  })
  @ApiForbiddenResponse({
    description: 'Caller lacks permission for this organization',
  })
  @ApiNotFoundResponse({ description: 'Organization not found' })
  getDashboard(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number,
  ): Promise<OrganizationDashboardDetailDto> {
    return this.storageService.getOrganizationDashboard(req, organizationId);
  }

  @Get('storage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Get organization storage utilization, folder path, and stored banners/files (super or organization administrator)',
  })
  @ApiOkResponse({
    description: 'Storage quota, used bytes, assigned folder path, and file inventory',
    type: OrganizationStorageDetailDto,
  })
  @ApiForbiddenResponse({
    description: 'Caller lacks permission for this organization',
  })
  @ApiNotFoundResponse({ description: 'Organization not found' })
  getStorage(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number,
  ): Promise<OrganizationStorageDetailDto> {
    return this.storageService.getOrganizationStorage(req, organizationId);
  }
}
