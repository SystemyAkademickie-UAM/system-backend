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
import {
  GrantOrganizationAdministratorByEmailDto,
  GrantOrganizationAdministratorDto,
} from './dto/grant-organization-administrator.dto';
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

  @Get('candidates')
  @ApiOperation({ summary: 'List people in the organization who can receive the administrator role' })
  @ApiOkResponse({ description: 'People who already belong to the organization and are not administrators' })
  @ApiForbiddenResponse({ description: 'Caller lacks super role' })
  listCandidates(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number) {
    return this.adminOrganizationAdministratorsService.listCandidates(req, organizationId);
  }

  @Post('email')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Grant administrator in an email organization by name and email' })
  @ApiCreatedResponse({ description: 'User is created or reused, and the administrator account exists. Magic-link login can find them.' })
  @ApiForbiddenResponse({ description: 'Caller lacks super role, or the caller is granting the role to themselves' })
  grantAdministratorByEmail(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() dto: GrantOrganizationAdministratorByEmailDto) {
    return this.adminOrganizationAdministratorsService.grantAdministratorByEmail(req, organizationId, dto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Grant the administrator role to a person already in the organization' })
  @ApiCreatedResponse({ description: 'Administrator account created or returned if already granted' })
  @ApiNotFoundResponse({ description: 'That person is not in this organization' })
  @ApiForbiddenResponse({ description: 'Caller lacks super role, or the caller is granting the role to themselves' })
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
