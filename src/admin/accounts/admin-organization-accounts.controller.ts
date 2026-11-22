import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import {
  ORGANIZATION_ACCOUNT_EXPORT_FILENAME,
  ORGANIZATION_ACCOUNT_PAGE_SIZE_DEFAULT,
} from '../../constants/organization-account-management-constants';
import { MAQ_SESSION_COOKIE_NAME } from '../../constants/session-constants';
import { AccountRemovalService } from './account-removal.service';
import { AdminOrganizationAccountRosterService } from './admin-organization-account-roster.service';
import { AdminOrganizationAccountsService } from './admin-organization-accounts.service';
import {
  CreateOrganizationAccountDto,
  ImportOrganizationAccountsDto,
  ListOrganizationAccountsPageQueryDto,
  UpdateOrganizationAccountDto,
} from './dto/organization-account.dto';

@ApiTags('Admin organizations')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller('admin/organizations/:organizationId/accounts')
export class AdminOrganizationAccountsController {
  constructor(
    private readonly accountRemovalService: AccountRemovalService,
    private readonly adminOrganizationAccountsService: AdminOrganizationAccountsService,
    private readonly rosterService: AdminOrganizationAccountRosterService) {}

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export every account in this organization as CSV' })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV of accounts in this organization only' })
  @ApiForbiddenResponse({ description: 'Caller lacks permission for this organization' })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', `attachment; filename="${ORGANIZATION_ACCOUNT_EXPORT_FILENAME}"`)
  exportAccounts(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number): Promise<string> {
    return this.rosterService.exportOrganizationAccountsCsv(req, organizationId);
  }

  @Get('page')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List one page of accounts ordered by account id' })
  @ApiOkResponse({ description: 'Page plus nextAfterAccountId for the following request' })
  @ApiForbiddenResponse({ description: 'Caller lacks permission for this organization' })
  listAccountPage(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Query() query: ListOrganizationAccountsPageQueryDto) {
    const afterAccountId = query.afterAccountId ?? 0;
    const limit = query.limit ?? ORGANIZATION_ACCOUNT_PAGE_SIZE_DEFAULT;
    return this.rosterService.listOrganizationAccountPage(req, organizationId, afterAccountId, limit);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List every account in this organization (org administrator or super)',
  })
  @ApiOkResponse({ description: 'Accounts with user email, name, nickname, and role' })
  @ApiForbiddenResponse({ description: 'Caller lacks permission for this organization' })
  listAccounts(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number) {
    return this.adminOrganizationAccountsService.listOrganizationAccounts(req, organizationId);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import accounts for this organization' })
  @ApiOkResponse({ description: 'Counts of created, updated, skipped, and failed rows' })
  @ApiForbiddenResponse({ description: 'Caller lacks permission for this organization' })
  importAccounts(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() body: ImportOrganizationAccountsDto) {
    return this.rosterService.importOrganizationAccounts(req, organizationId, body);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add one account in this organization' })
  @ApiCreatedResponse({ description: 'Account created or linked to an existing person' })
  @ApiConflictResponse({ description: 'That email already has this role in the organization' })
  @ApiForbiddenResponse({ description: 'Caller lacks permission for this organization' })
  createAccount(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Body() body: CreateOrganizationAccountDto) {
    return this.rosterService.createOrganizationAccount(req, organizationId, body);
  }

  @Get(':accountId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Read one account in this organization' })
  @ApiOkResponse({ description: 'Account with user email, name, nickname, and role' })
  @ApiNotFoundResponse({ description: 'Account is not in this organization' })
  @ApiForbiddenResponse({ description: 'Caller lacks permission for this organization' })
  getAccount(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Param('accountId', ParseIntPipe) accountId: number) {
    return this.rosterService.getOrganizationAccount(req, organizationId, accountId);
  }

  @Patch(':accountId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change one account in this organization' })
  @ApiOkResponse({ description: 'Updated account' })
  @ApiNotFoundResponse({ description: 'Account is not in this organization' })
  @ApiConflictResponse({ description: 'Email or role is already used, or the person belongs to another organization' })
  @ApiForbiddenResponse({ description: 'Caller lacks permission for this organization or this role' })
  updateAccount(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Param('accountId', ParseIntPipe) accountId: number,
    @Body() body: UpdateOrganizationAccountDto) {
    return this.rosterService.updateOrganizationAccount(req, organizationId, accountId, body);
  }

  @Post(':accountId/magic-link')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Email a magic login link to one account in an email-login organization' })
  @ApiOkResponse({ description: 'Magic link was queued' })
  @ApiNotFoundResponse({ description: 'Account is not in this organization' })
  @ApiForbiddenResponse({ description: 'Caller lacks permission for this organization' })
  sendMagicLink(
    @Req() req: Request,
    @Param('organizationId', ParseIntPipe) organizationId: number,
    @Param('accountId', ParseIntPipe) accountId: number) {
    return this.rosterService.sendOrganizationAccountMagicLink(req, organizationId, accountId);
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
