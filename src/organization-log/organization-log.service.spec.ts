import { ORGANIZATION_LOG_CATEGORY_ORGANIZATION, ORGANIZATION_LOG_KIND_SIGNED_IN } from '../constants/organization-log-constants';
import { OrganizationLogService } from './organization-log.service';

function repository() {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((row: unknown) => row),
    save: jest.fn(async (row: unknown) => row),
    getRepository: jest.fn(),
  };
}

describe('OrganizationLogService', () => {
  const organizationLogRepository = repository();
  const groupRepository = repository();
  let service: OrganizationLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrganizationLogService(
      organizationLogRepository as never,
      repository() as never,
      repository() as never,
      groupRepository as never,
    );
  });

  it('stores one organization action', async () => {
    await service.record({
      organizationId: 3,
      category: ORGANIZATION_LOG_CATEGORY_ORGANIZATION,
      kind: ORGANIZATION_LOG_KIND_SIGNED_IN,
      actorName: 'Ada Local',
    });
    expect(organizationLogRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 3,
      actorName: 'Ada Local',
      kind: ORGANIZATION_LOG_KIND_SIGNED_IN,
    }));
  });

  it('skips a group action when the group is missing', async () => {
    await service.recordForGroup({
      groupId: 9,
      kind: 'group_created',
      actorAccountId: 4,
    });
    expect(organizationLogRepository.save).not.toHaveBeenCalled();
  });
});
