import { GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';
import { OrganizationLogLinksReader } from './organization-log-links.reader';
import type { OrganizationLogListItem } from './organization-log.types';

function item(groupId: number, accountId: number): OrganizationLogListItem {
  return {
    id: `archive:${groupId}`,
    source: 'archive',
    occurredAt: '2026-11-16T19:00:00.000Z',
    category: 'group',
    kind: 'role_granted',
    actorName: '',
    subjectName: '',
    subjectAccountId: accountId,
    internalGroupId: groupId,
    groupName: 'Stored name',
    roleName: 'student',
    fileKind: null,
    fileName: null,
    fileSizeBytes: null,
    detail: {},
    links: { group: null, account: null, profile: null },
  };
}

describe('OrganizationLogLinksReader', () => {
  const groupRepository = { find: jest.fn() };
  const accountRepository = { find: jest.fn() };
  const userRepository = { find: jest.fn() };
  const enrollmentRepository = { find: jest.fn() };
  const reader = new OrganizationLogLinksReader(
    groupRepository as never,
    accountRepository as never,
    userRepository as never,
    enrollmentRepository as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    groupRepository.find.mockResolvedValue([
      { id: 4, name: 'Quest', teacherAccountId: 9 },
      { id: 5, name: 'Elsewhere', teacherAccountId: 8 },
    ]);
    accountRepository.find.mockImplementation(async (options: { where: { organizationId?: number } }) => {
      if (options.where.organizationId === 3) {
        return [{ id: 11, userId: 7 }];
      }
      return [
        { id: 9, organizationId: 3 },
        { id: 8, organizationId: 99 },
      ];
    });
    userRepository.find.mockResolvedValue([{ id: 7, name: 'Grace', surname: 'Hopper' }]);
    enrollmentRepository.find.mockResolvedValue([{ groupId: 4, studentAccountId: 11 }]);
  });

  it('links a person and group that still belong to the organization', async () => {
    const actual = await reader.attach(3, [item(4, 11), item(5, 12)]);
    const publicGroupId = 4 + GROUP_RESPONSE_GROUP_ID_OFFSET;
    expect(actual[0]).toEqual(expect.objectContaining({
      subjectName: 'Grace Hopper',
      groupName: 'Quest',
      links: {
        group: `/groups/${publicGroupId}`,
        account: '/users?accountId=11',
        profile: `/groups/${publicGroupId}/student-profile/11`,
      },
    }));
    expect(actual[0]).not.toHaveProperty('internalGroupId');
    expect(actual[1]?.links).toEqual({ group: null, account: null, profile: null });
  });
});
