import { ORGANIZATION_LOG_CATEGORY_GROUP } from '../constants/organization-log-constants';
import { OrganizationLogArchiveReader } from './organization-log-archive.reader';
import type { OrganizationLogListQuery } from './organization-log.types';

const EMPTY_CURSOR: OrganizationLogListQuery = {
  category: 'group',
  limit: 10,
  before: null,
  beforeId: null,
  beforeSource: null,
};

describe('OrganizationLogArchiveReader', () => {
  const organizationLogRepository = { query: jest.fn().mockResolvedValue([]) };
  const reader = new OrganizationLogArchiveReader(organizationLogRepository as never);

  beforeEach(() => {
    organizationLogRepository.query.mockClear();
  });

  it('keeps the organization id in a parameter', async () => {
    await reader.load(3, ORGANIZATION_LOG_CATEGORY_GROUP, 10, EMPTY_CURSOR);
    const [sql, params] = organizationLogRepository.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('organization_id = $1');
    expect(sql).toContain('category = $2');
    expect(params).toEqual([3, ORGANIZATION_LOG_CATEGORY_GROUP, 10]);
  });
});
