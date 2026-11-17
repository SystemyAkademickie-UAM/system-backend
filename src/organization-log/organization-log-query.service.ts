import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { ORGANIZATION_LOG_PAGE_PROBE_EXTRA } from '../constants/organization-log-constants';
import { ADMINISTRATOR_ROLE_NAME } from '../constants/role-name-constants';
import { SessionService } from '../auth/session/session.service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { OrganizationLogArchiveReader } from './organization-log-archive.reader';
import { OrganizationLogInboxReader } from './organization-log-inbox.reader';
import { OrganizationLogLinksReader } from './organization-log-links.reader';
import { OrganizationLogRows } from './organization-log-rows';
import type { OrganizationLogListQuery, OrganizationLogListResponse } from './organization-log.types';

/**
 * Reads one page of the organization administrator log.
 */
@Injectable()
export class OrganizationLogQueryService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    private readonly archiveReader: OrganizationLogArchiveReader,
    private readonly inboxReader: OrganizationLogInboxReader,
    private readonly linksReader: OrganizationLogLinksReader,
  ) {}

  /**
   * Returns one page for the administrator of the session organization.
   * A supervising person without that role in the session organization is refused.
   */
  async listForSessionAdministrator(req: Request, query: OrganizationLogListQuery): Promise<OrganizationLogListResponse> {
    const organizationId = await this.requireSessionAdministrator(req);
    const pageSize = OrganizationLogRows.clampLimit(query.limit);
    const fetchSize = pageSize + ORGANIZATION_LOG_PAGE_PROBE_EXTRA;
    const archive = await this.archiveReader.load(organizationId, query.category, fetchSize, query);
    const inbox = await this.inboxReader.load(organizationId, query.category, fetchSize, query);
    const merged = OrganizationLogRows.merge(archive, inbox, pageSize);
    const items = await this.linksReader.attach(organizationId, merged);
    return OrganizationLogRows.toResponse(items, archive.length + inbox.length > pageSize);
  }

  private async requireSessionAdministrator(req: Request): Promise<number> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (subject === null || subject.organizationId === null) {
      throw new ForbiddenException('Not authorized');
    }
    const isAdministrator = await this.userRolesService.userHasRoleInOrganization(
      subject.userId,
      subject.organizationId,
      ADMINISTRATOR_ROLE_NAME,
    );
    if (!isAdministrator) {
      throw new ForbiddenException('Not authorized');
    }
    return subject.organizationId;
  }
}
