import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../../constants/session-constants';
import { GrantOrganizationAdministratorDto } from './dto/grant-organization-administrator.dto';
import { AdminOrganizationAdministratorsService } from './admin-organization-administrators.service';

@ApiTags('Admin organizations')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller('admin/organizations/:organizationId/administrators')
export class AdminOrganizationAdministratorsController {
  constructor(
    private readonly adminOrganizationAdministratorsService: AdminOrganizationAdministratorsService) {}

  @Get()
  @ApiOperation({ summary: 'List organization administrators (super role)' })
  @ApiOkResponse({ description: 'Administrators bound to the organization' })
  @ApiForbiddenResponse({ description: 'Caller lacks super role' })
  listAdministrators(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number) {
    return this.adminOrganizationAdministratorsService.listAdministrators(req, organizationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Grant organization administrator role by user email (super role)' })
  @ApiCreatedResponse({ description: 'Administrator account created or returned if already granted' })
  @ApiNotFoundResponse({ description: 'User must log in via SAML before grant' })
  @ApiForbiddenResponse({ description: 'Caller lacks super role' })
  grantAdministrator(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() dto: GrantOrganizationAdministratorDto) {
    return this.adminOrganizationAdministratorsService.grantAdministrator(req, organizationId, dto);
  }

  @Delete(':accountId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke organization administrator role (super role)' })
  @ApiForbiddenResponse({ description: 'Caller lacks super role' })
  async revokeAdministrator(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Param('accountId', ParseIntPipe) accountId: number): Promise<void> {
    await this.adminOrganizationAdministratorsService.revokeAdministrator(
      req,
      organizationId,
      accountId);
  }
}
