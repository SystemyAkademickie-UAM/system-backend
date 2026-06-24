import { Controller, Get, HttpCode, HttpStatus, Req } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../../constants/session-constants';
import { AdminOrganizationAccountsService } from './admin-organization-accounts.service';

@ApiTags('Admin organizations')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller('admin/manageable-organizations')
export class AdminManageableOrganizationsController {
  constructor(
    private readonly adminOrganizationAccountsService: AdminOrganizationAccountsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List organizations the caller may manage accounts for (super or org administrator)',
  })
  @ApiOkResponse({ description: 'Active organizations visible to the caller' })
  @ApiForbiddenResponse({ description: 'Not authenticated' })
  listManageableOrganizations(@Req() req: Request) {
    return this.adminOrganizationAccountsService.listManageableOrganizations(req);
  }
}
