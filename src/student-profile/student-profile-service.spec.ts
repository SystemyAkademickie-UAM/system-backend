import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { Request } from 'express';

import { SessionService } from '../auth/session/session.service';
import { GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { UserRolesService } from '../user-roles/user-roles-service';
import { StudentProfileService } from './student-profile-service';

const INTERNAL_GROUP_ID = 7;
const PUBLIC_GROUP_ID = GROUP_RESPONSE_GROUP_ID_OFFSET + INTERNAL_GROUP_ID;
const STUDENT_ACCOUNT_ID = 42;
const OTHER_STUDENT_ACCOUNT_ID = 99;
const ENROLLMENT_ID = 15;

describe('StudentProfileService — earnedBadges.isSecret', () => {
  let service: StudentProfileService;
  let sessionService: { resolveSubjectFromRequest: jest.Mock };
  let userRolesService: {
    userHasRole: jest.Mock;
    userHasRoleInOrganization: jest.Mock;
    findAccountIdForRole: jest.Mock;
  };
  let dataSource: { query: jest.Mock };
  const mockRequest = { headers: {} } as unknown as Request;

  beforeEach(async () => {
    sessionService = {
      resolveSubjectFromRequest: jest.fn().mockResolvedValue({
        userId: 1,
        sessionId: 1,
        activeRole: STUDENT_ROLE_NAME,
        organizationId: 3,
      }),
    };
    userRolesService = {
      userHasRole: jest.fn().mockResolvedValue(false),
      userHasRoleInOrganization: jest.fn().mockResolvedValue(false),
      findAccountIdForRole: jest.fn(async (_userId: number, roleName: string) =>
        roleName === STUDENT_ROLE_NAME ? STUDENT_ACCOUNT_ID : null),
    };
    dataSource = { query: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentProfileService,
        { provide: SessionService, useValue: sessionService },
        { provide: UserRolesService, useValue: userRolesService },
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    service = module.get<StudentProfileService>(StudentProfileService);
  });

  it('returns Unauthorized when session is missing', async () => {
    sessionService.resolveSubjectFromRequest.mockResolvedValue(null);
    const actual = await service.getStudentProfile(mockRequest, PUBLIC_GROUP_ID);
    expect(actual).toEqual({ error: 'Unauthorized' });
  });

  it('prevents a student from reading another student profile', async () => {
    userRolesService.findAccountIdForRole.mockImplementation(async (_userId: number, roleName: string) => {
      if (roleName === LECTURER_ROLE_NAME) {
        return null;
      }
      return STUDENT_ACCOUNT_ID;
    });
    const actual = await service.getStudentProfile(mockRequest, PUBLIC_GROUP_ID, OTHER_STUDENT_ACCOUNT_ID);
    expect(actual).toEqual({ error: 'Unauthorized' });
  });

  it('maps isSecret on earned badges for the owning student profile', async () => {
    dataSource.query
      .mockResolvedValueOnce([
        {
          enrollmentId: ENROLLMENT_ID,
          studentAccountId: STUDENT_ACCOUNT_ID,
          nickname: 'PlayerOne',
          name: 'Jan',
          surname: 'Kowalski',
          avatarId: 1,
          avatarUrl: null,
          currency: 50,
          totalEarned: 100,
          rankId: null,
          rankName: null,
          groupCurrency: 'Złoto',
          groupCurrencyEmoji: '🪙',
          lives: 3,
          livesIcon: 1,
          livesEnabled: true,
          shopOpen: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          name: 'Pierwsze kroki',
          icon: '🏅',
          rarity: 'common',
          storyDescription: null,
          educationalDescription: 'Opis',
          rewardAmount: 10,
          isSecret: false,
        },
        {
          id: 2,
          name: 'Ukryty mistrz',
          icon: '🦉',
          rarity: 'epic',
          storyDescription: 'Tajemnica',
          educationalDescription: 'Sekret',
          rewardAmount: 42,
          isSecret: true,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { type: 'SHOP_PURCHASE', value: '{}' },
        { type: 'ITEM_USED', value: '{}' },
        { type: 'LIVES_CHANGED', value: JSON.stringify({ delta: -1 }) },
      ]);
    const actual = await service.getStudentProfile(mockRequest, PUBLIC_GROUP_ID);
    expect(dataSource.query).toHaveBeenCalledTimes(4);
    expect('error' in actual).toBe(false);
    if (!('error' in actual)) {
      expect(actual.badgesCount).toBe(2);
      expect(actual.purchasedItemsCount).toBe(1);
      expect(actual.usedItemsCount).toBe(1);
      expect(actual.lostLivesCount).toBe(1);
      expect(actual.earnedBadges).toEqual([
        expect.objectContaining({ id: 1, name: 'Pierwsze kroki', isSecret: false }),
        expect.objectContaining({ id: 2, name: 'Ukryty mistrz', isSecret: true }),
      ]);
    }
  });
});
