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
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  UploadOrganizationCertificateDto,
} from './dto/admin-organization.dto';
import { AdminOrganizationsService } from './admin-organizations.service';

@Controller('admin/organizations')
export class AdminOrganizationsController {
  constructor(private readonly adminOrganizationsService: AdminOrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createOrganization(@Req() req: Request, @Body() dto: CreateOrganizationDto) {
    return this.adminOrganizationsService.createOrganization(req, dto);
  }

  @Get()
  listOrganizations(@Req() req: Request, @Query('auth') auth: string | undefined) {
    return this.adminOrganizationsService.listOrganizations(req, auth);
  }

  @Get(':id')
  getOrganization(
    @Req() req: Request,
    @Param('id', ParseIntPipe) organizationId: number,
    @Query('auth') auth: string | undefined,
  ) {
    return this.adminOrganizationsService.getOrganization(req, organizationId, auth);
  }

  @Patch(':id')
  updateOrganization(
    @Req() req: Request,
    @Param('id', ParseIntPipe) organizationId: number,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.adminOrganizationsService.updateOrganization(req, organizationId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOrganization(
    @Req() req: Request,
    @Param('id', ParseIntPipe) organizationId: number,
    @Query('auth') auth: string | undefined,
  ): Promise<void> {
    await this.adminOrganizationsService.softDeleteOrganization(req, organizationId, auth);
  }

  @Post(':id/sync-from-metadata')
  syncFromMetadata(
    @Req() req: Request,
    @Param('id', ParseIntPipe) organizationId: number,
    @Query('auth') auth: string | undefined,
  ) {
    return this.adminOrganizationsService.syncFromMetadata(req, organizationId, auth);
  }

  @Post(':id/certificates')
  addCertificate(
    @Req() req: Request,
    @Param('id', ParseIntPipe) organizationId: number,
    @Body() dto: UploadOrganizationCertificateDto,
  ) {
    return this.adminOrganizationsService.addCertificate(req, organizationId, dto);
  }

  @Delete(':id/certificates/:certId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeCertificate(
    @Req() req: Request,
    @Param('id', ParseIntPipe) organizationId: number,
    @Param('certId', ParseIntPipe) certificateId: number,
    @Query('auth') auth: string | undefined,
  ): Promise<void> {
    await this.adminOrganizationsService.revokeCertificate(req, organizationId, certificateId, auth);
  }
}
