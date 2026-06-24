import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../../constants/session-constants';
import { AccountRemovalService } from './account-removal.service';
import { AdminOrganizationAccountsService } from './admin-organization-accounts.service';

@ApiTags('Admin organizations')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller('admin/organizations/:organizationId/accounts')
export class AdminOrganizationAccountsController {
  constructor(
    private readonly accountRemovalService: AccountRemovalService,
    private readonly adminOrganizationAccountsService: AdminOrganizationAccountsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List organization accounts (org administrator or super)',
  })
  @ApiOkResponse({ description: 'Accounts with user email, nickname, and role' })
  @ApiForbiddenResponse({ description: 'Caller lacks permission' })
  listAccounts(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number) {
    return this.adminOrganizationAccountsService.listOrganizationAccounts(req, organizationId);
  }

  @Delete(':accountId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Delete an organization account (org administrator or super; lecturers and students cannot)',
  })
  @ApiOkResponse({ description: 'Account removed; user row deleted when no memberships remain' })
  @ApiNotFoundResponse({ description: 'Organization or account not found' })
  @ApiForbiddenResponse({ description: 'Caller lacks permission or target is protected' })
  @ApiConflictResponse({ description: 'Account owns groups and cannot be removed yet' })
  deleteAccount(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Param('accountId', ParseIntPipe) accountId: number) {
    return this.accountRemovalService.deleteOrganizationAccount(req, organizationId, accountId);
  }
}
