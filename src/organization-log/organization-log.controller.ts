import { Controller, Get, HttpCode, HttpStatus, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../constants/session-constants';
import { ORGANIZATION_LOG_PAGE_SIZE_DEFAULT } from '../constants/organization-log-constants';
import { ListOrganizationLogQueryDto } from './dto/list-organization-log.query';
import { OrganizationLogQueryService } from './organization-log-query.service';
import type { OrganizationLogListResponse } from './organization-log.types';

@ApiTags('Organization log')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller('admin/organization-log')
export class OrganizationLogController {
  constructor(private readonly organizationLogQueryService: OrganizationLogQueryService) {}

  /**
   * Lists one page of the session organization's administrator log.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List the organization administrator log for the session organization' })
  @ApiOkResponse({ description: 'One page of organization and group lines' })
  @ApiForbiddenResponse({ description: 'Caller is not an administrator of the session organization' })
  list(
    @Req() req: Request,
    @Query() query: ListOrganizationLogQueryDto,
  ): Promise<OrganizationLogListResponse> {
    return this.organizationLogQueryService.listForSessionAdministrator(req, {
      category: query.category ?? 'all',
      limit: query.limit ?? ORGANIZATION_LOG_PAGE_SIZE_DEFAULT,
      before: query.before === undefined ? null : new Date(query.before),
      beforeId: query.beforeId ?? null,
      beforeSource: query.beforeSource ?? null,
    });
  }
}
