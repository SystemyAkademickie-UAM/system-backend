import { ForbiddenException } from '@nestjs/common';

import { ORGANIZATION_LOG_CATEGORY_ORGANIZATION, ORGANIZATION_LOG_KIND_SIGNED_IN } from '../constants/organization-log-constants';
import { OrganizationLogQueryService } from './organization-log-query.service';
import type { OrganizationLogArchiveRow, OrganizationLogListQuery } from './organization-log.types';

const EMPTY_CURSOR: OrganizationLogListQuery = {
  category: 'all',
  limit: 50,
  before: null,
  beforeId: null,
  beforeSource: null,
};

describe('OrganizationLogQueryService', () => {
  const sessionService = { resolveSubjectFromRequest: jest.fn() };
  const userRolesService = { userHasRoleInOrganization: jest.fn() };
  const archiveReader = { load: jest.fn().mockResolvedValue([]) };
  const inboxReader = { load: jest.fn().mockResolvedValue([]) };
  const linksReader = { attach: jest.fn(async (_organizationId: number, items: unknown[]) => items) };
  let service: OrganizationLogQueryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrganizationLogQueryService(
      sessionService as never,
      userRolesService as never,
      archiveReader as never,
      inboxReader as never,
      linksReader as never,
    );
  });

  it('refuses a caller who is not signed in', async () => {
    sessionService.resolveSubjectFromRequest.mockResolvedValue(null);
    await expect(service.listForSessionAdministrator({} as never, EMPTY_CURSOR)).rejects.toBeInstanceOf(ForbiddenException);
    expect(archiveReader.load).not.toHaveBeenCalled();
  });

  it('returns one page for an administrator of the session organization', async () => {
    const inputRow: OrganizationLogArchiveRow = {
      id: 4,
      occurredAt: new Date('2026-11-16T19:00:00.000Z'),
      category: ORGANIZATION_LOG_CATEGORY_ORGANIZATION,
      kind: ORGANIZATION_LOG_KIND_SIGNED_IN,
      actorName: 'Ada Local',
      subjectName: 'Ada Local',
      subjectAccountId: null,
      groupId: null,
      groupName: '',
      roleName: null,
      fileKind: null,
      fileName: null,
      fileSizeBytes: null,
      detail: null,
    };
    sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 4, organizationId: 3 });
    userRolesService.userHasRoleInOrganization.mockResolvedValue(true);
    archiveReader.load.mockResolvedValue([inputRow]);
    inboxReader.load.mockResolvedValue([]);

    const actual = await service.listForSessionAdministrator({} as never, EMPTY_CURSOR);

    expect(archiveReader.load).toHaveBeenCalledWith(3, 'all', 51, EMPTY_CURSOR);
    expect(actual.items).toHaveLength(1);
    expect(actual.items[0]?.actorName).toBe('Ada Local');
    expect(actual.nextBefore).toBeNull();
  });
});
