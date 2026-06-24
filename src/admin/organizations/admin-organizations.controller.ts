import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../../constants/session-constants';

import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  UploadOrganizationCertificateDto,
} from './dto/admin-organization.dto';
import { AdminOrganizationsService } from './admin-organizations.service';

@ApiTags('Admin organizations')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller('admin/organizations')
export class AdminOrganizationsController {
  constructor(private readonly adminOrganizationsService: AdminOrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create organization (super role)' })
  @ApiCreatedResponse({ description: 'Organization created with SAML metadata summary' })
  @ApiForbiddenResponse({ description: 'Caller lacks super role' })
  createOrganization(@Req() req: Request, @Body() dto: CreateOrganizationDto) {
    return this.adminOrganizationsService.createOrganization(req, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List organizations (super role)' })
  @ApiOkResponse({ description: 'Organizations with certificate summary fields' })
  @ApiForbiddenResponse({ description: 'Caller lacks super role' })
  listOrganizations(@Req() req: Request) {
    return this.adminOrganizationsService.listOrganizations(req);
  }

  @Get(':id')
  getOrganization(
    @Req() req: Request,
    @Param('id', ParseIntPipe) organizationId: number) {
    return this.adminOrganizationsService.getOrganization(req, organizationId);
  }

  @Patch(':id')
  updateOrganization(
    @Req() req: Request,
    @Param('id', ParseIntPipe) organizationId: number,
    @Body() dto: UpdateOrganizationDto) {
    return this.adminOrganizationsService.updateOrganization(req, organizationId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOrganization(
    @Req() req: Request,
    @Param('id', ParseIntPipe) organizationId: number): Promise<void> {
    await this.adminOrganizationsService.softDeleteOrganization(req, organizationId);
  }

  @Post(':id/sync-from-metadata')
  syncFromMetadata(
    @Req() req: Request,
    @Param('id', ParseIntPipe) organizationId: number) {
    return this.adminOrganizationsService.syncFromMetadata(req, organizationId);
  }

  @Post(':id/certificates')
  addCertificate(
    @Req() req: Request,
    @Param('id', ParseIntPipe) organizationId: number,
    @Body() dto: UploadOrganizationCertificateDto) {
    return this.adminOrganizationsService.addCertificate(req, organizationId, dto);
  }

  @Delete(':id/certificates/:certId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeCertificate(
    @Req() req: Request,
    @Param('id', ParseIntPipe) organizationId: number,
    @Param('certId', ParseIntPipe) certificateId: number): Promise<void> {
    await this.adminOrganizationsService.revokeCertificate(req, organizationId, certificateId);
  }
}
