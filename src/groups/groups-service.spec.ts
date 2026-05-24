import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { GROUP_API_JSON_STATUS_OK, GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { GroupsService } from './groups-service';

type MockQueryBuilder = {
  leftJoin: jest.Mock;
  select: jest.Mock;
  addSelect: jest.Mock;
  setParameter: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  groupBy: jest.Mock;
  addGroupBy: jest.Mock;
  orderBy: jest.Mock;
  getRawMany: jest.Mock;
};

type MockGroupRepository = {
  createQueryBuilder: jest.Mock<MockQueryBuilder, []>;
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  exist: jest.Mock;
};

const mockRequest = {} as Request;

describe('GroupsService', () => {
  let service: GroupsService;
  let authTokenSessionService: jest.Mocked<AuthTokenSessionService>;
  let userRolesService: jest.Mocked<UserRolesService>;
  let mockQueryBuilder: MockQueryBuilder;
  let groupRepository: MockGroupRepository;

  beforeEach(async () => {
    const mockAuthTokenSessionService = {
      resolveSubjectStrongFromRequest: jest.fn(),
    };
    const mockUserRolesService = {
      findAccountIdForRole: jest.fn(),
    };
    mockQueryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };
    groupRepository = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      exist: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: AuthTokenSessionService, useValue: mockAuthTokenSessionService },
        { provide: UserRolesService, useValue: mockUserRolesService },
        { provide: getRepositoryToken(GroupEntity), useValue: groupRepository },
      ],
    }).compile();
    service = module.get<GroupsService>(GroupsService);
    authTokenSessionService = module.get(AuthTokenSessionService);
    userRolesService = module.get(UserRolesService);
  });

  describe('getUserGroups', () => {
    it('should return empty array if no valid session subject is found', async () => {
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue(null);
      const result = await service.getUserGroups(mockRequest, 'browser-id', undefined);
      expect(result).toEqual({ statusCode: GROUP_API_JSON_STATUS_OK, groups: [] });
      expect(authTokenSessionService.resolveSubjectStrongFromRequest).toHaveBeenCalledWith(
        mockRequest,
        'browser-id',
        undefined,
      );
    });

    it('should pass optional auth query token to session resolution', async () => {
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue(null);
      await service.getUserGroups(mockRequest, 'browser-id', 'plain-token');
      expect(authTokenSessionService.resolveSubjectStrongFromRequest).toHaveBeenCalledWith(
        mockRequest,
        'browser-id',
        'plain-token',
      );
    });

    it('should return empty array if user has neither student nor lecturer roles', async () => {
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.findAccountIdForRole.mockResolvedValue(null);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      const result = await service.getUserGroups(mockRequest, 'browser-id', undefined);
      expect(result).toEqual({ statusCode: GROUP_API_JSON_STATUS_OK, groups: [] });
    });

    it('should fetch and map enrolled groups into myGroups when user is student', async () => {
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.findAccountIdForRole.mockImplementation(async (_userId, role) => {
        if (role === STUDENT_ROLE_NAME) {
          return 10;
        }
        return null;
      });
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          id: 5,
          name: 'Math 101',
          image_ref: 'img_uuid',
          description: 'Basic math',
          teacher_name: 'John',
          teacher_surname: 'Doe',
          is_owner: false,
          is_enrolled: true,
        },
        {
          id: 6,
          name: 'Other course',
          image_ref: null,
          description: null,
          teacher_name: 'Jane',
          teacher_surname: 'Smith',
          is_owner: false,
          is_enrolled: false,
        },
      ]);
      const result = await service.getUserGroups(mockRequest, 'browser-id', undefined);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('group.name', 'ASC');
      expect(result).toEqual({
        statusCode: GROUP_API_JSON_STATUS_OK,
        groups: [
          {
            id: 5 + GROUP_RESPONSE_GROUP_ID_OFFSET,
            groupName: 'Math 101',
            subjectName: 'Math 101',
            bannerId: 'img_uuid',
            lecturers: 'John Doe',
            description: 'Basic math',
          },
        ],
      });
    });

    it('should split catalog into myGroups and otherGroups', async () => {
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 2 });
      userRolesService.findAccountIdForRole.mockImplementation(async (_userId, role) => {
        if (role === LECTURER_ROLE_NAME) {
          return 30;
        }
        return null;
      });
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          id: 1,
          name: 'Owned',
          image_ref: null,
          description: null,
          teacher_name: 'Ann',
          teacher_surname: 'Lee',
          is_owner: true,
          is_enrolled: false,
        },
        {
          id: 2,
          name: 'Foreign',
          image_ref: null,
          description: null,
          teacher_name: 'Bob',
          teacher_surname: 'Kay',
          is_owner: false,
          is_enrolled: false,
        },
      ]);
      const result = await service.getGroupsCatalog(mockRequest, 'browser-id', undefined);
      expect(result.myGroups).toHaveLength(1);
      expect(result.otherGroups).toHaveLength(1);
      expect(result.myGroups[0].groupName).toBe('Owned');
      expect(result.otherGroups[0].groupName).toBe('Foreign');
    });

    it('should include enrollment join when user has student role', async () => {
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 3 });
      userRolesService.findAccountIdForRole.mockImplementation(async (_userId, role) => {
        if (role === LECTURER_ROLE_NAME) {
          return 40;
        }
        if (role === STUDENT_ROLE_NAME) {
          return 50;
        }
        return null;
      });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      await service.getGroupsCatalog(mockRequest, 'browser-id', undefined);
      expect(mockQueryBuilder.setParameter).toHaveBeenCalledWith('lecturerId', 40);
      expect(mockQueryBuilder.leftJoin).toHaveBeenCalledTimes(3);
    });

    it('should use empty string fallback if lecturer name is missing', async () => {
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.findAccountIdForRole.mockImplementation(async (_userId, role) => {
        if (role === LECTURER_ROLE_NAME) {
          return 20;
        }
        return null;
      });
      mockQueryBuilder.getRawMany.mockResolvedValue([
        {
          id: 1,
          name: 'Programming',
          image_ref: null,
          description: null,
          teacher_name: null,
          teacher_surname: null,
          is_owner: true,
          is_enrolled: false,
        },
      ]);
      const result = await service.getUserGroups(mockRequest, 'browser-id', undefined);
      expect(result.groups[0].lecturers).toBe('');
    });

    it('should return existing entry code for group owner', async () => {
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      groupRepository.findOne.mockResolvedValue({
        id: 1,
        teacherAccountId: 10,
        entryCode: 'ABC123',
      });

      const result = await service.getAccessCodeForGroup(mockRequest, 100001, 'browser-id', undefined);

      expect(result.code).toBe('ABC123');
      expect(result.groupId).toBe(100001);
    });
  });
});
