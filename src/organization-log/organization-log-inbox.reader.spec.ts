import { ORGANIZATION_LOG_CATEGORY_ORGANIZATION } from '../constants/organization-log-constants';
import { OrganizationLogInboxReader } from './organization-log-inbox.reader';
import type { OrganizationLogListQuery } from './organization-log.types';

const EMPTY_CURSOR: OrganizationLogListQuery = {
  category: 'all',
  limit: 10,
  before: null,
  beforeId: null,
  beforeSource: null,
};

describe('OrganizationLogInboxReader', () => {
  const organizationLogRepository = { query: jest.fn() };
  const reader = new OrganizationLogInboxReader(organizationLogRepository as never);

  beforeEach(() => {
    organizationLogRepository.query.mockReset();
  });

  it('returns no rows for an organization-only page', async () => {
    const actual = await reader.load(3, ORGANIZATION_LOG_CATEGORY_ORGANIZATION, 10, EMPTY_CURSOR);
    expect(actual).toEqual([]);
    expect(organizationLogRepository.query).not.toHaveBeenCalled();
  });

  it('maps a known inbox type and drops an unknown one', async () => {
    organizationLogRepository.query
      .mockResolvedValueOnce([{ cutoff: null }])
      .mockResolvedValueOnce([
        {
          id: 8,
          occurredAt: '2026-11-16T19:00:00.000Z',
          kind: 'STUDENT_JOINED',
          accountId: 11,
          groupId: 4,
          groupName: 'Quest',
          detail: { activityName: 'Lab' },
        },
        {
          id: 9,
          occurredAt: '2026-11-16T19:01:00.000Z',
          kind: 'OTHER',
          accountId: null,
          groupId: 4,
          groupName: 'Quest',
          detail: {},
        },
      ]);

    const actual = await reader.load(3, 'all', 10, EMPTY_CURSOR);

    expect(organizationLogRepository.query.mock.calls[0]?.[1]).toEqual([3]);
    expect(actual).toEqual([
      expect.objectContaining({ id: 8, kind: 'student_joined', accountId: 11, groupId: 4 }),
    ]);
  });
});
