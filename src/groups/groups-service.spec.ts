import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GroupsService } from './groups-service';
import { GroupEntity } from '../database/entities/group.entity';
import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { GROUP_API_JSON_STATUS_OK, GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../constants/role-name-constants';

describe('GroupsService', () => {
  let service: GroupsService;
  let authTokenSessionService: jest.Mocked<AuthTokenSessionService>;
  let userRolesService: jest.Mocked<UserRolesService>;
  let groupRepository: any;

  beforeEach(async () => {
    const mockAuthTokenSessionService = {
      resolveSubjectStrongFromRequest: jest.fn(),
    };
    const mockUserRolesService = {
      findAccountIdForRole: jest.fn(),
    };
    
    // Create a mock query builder for typeorm repository
    const mockQueryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };

    const mockGroupRepository = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupsService,
        { provide: AuthTokenSessionService, useValue: mockAuthTokenSessionService },
        { provide: UserRolesService, useValue: mockUserRolesService },
        { provide: getRepositoryToken(GroupEntity), useValue: mockGroupRepository },
      ],
    }).compile();

    service = module.get<GroupsService>(GroupsService);
    authTokenSessionService = module.get(AuthTokenSessionService);
    userRolesService = module.get(UserRolesService);
    groupRepository = module.get(getRepositoryToken(GroupEntity));
  });

  describe('getUserGroups', () => {
    it('should return empty array if no valid session subject is found', async () => {
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue(null);

      const result = await service.getUserGroups({} as any, 'browser-id');
      expect(result).toEqual({ statusCode: GROUP_API_JSON_STATUS_OK, groups: [] });
    });

    it('should return empty array if user has neither student nor lecturer roles', async () => {
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 } as any);
      userRolesService.findAccountIdForRole.mockResolvedValue(null);

      const result = await service.getUserGroups({} as any, 'browser-id');
      expect(result).toEqual({ statusCode: GROUP_API_JSON_STATUS_OK, groups: [] });
    });

    it('should fetch and map groups correctly with offsets when user is enrolled', async () => {
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 } as any);
      
      // Simulate user is a student (accountId: 10) but not a lecturer
      userRolesService.findAccountIdForRole.mockImplementation(async (userId, role) => {
        if (role === STUDENT_ROLE_NAME) return 10;
        return null;
      });

      const mockRawData = [
        {
          id: 5,
          name: 'Math 101',
          image_ref: 'img_uuid',
          description: 'Basic math',
          teacher_name: 'John',
          teacher_surname: 'Doe',
        }
      ];

      const qb = groupRepository.createQueryBuilder();
      qb.getRawMany.mockResolvedValue(mockRawData);

      const result = await service.getUserGroups({} as any, 'browser-id');

      expect(qb.groupBy).toHaveBeenCalledWith('group.id');
      expect(qb.orderBy).toHaveBeenCalledWith('group.name', 'ASC');
      expect(result).toEqual({
        statusCode: GROUP_API_JSON_STATUS_OK,
        groups: [
          {
            id: 5 + GROUP_RESPONSE_GROUP_ID_OFFSET,
            groupName: 'Math 101',
            subjectName: 'Math 101',
            bannerId: 'img_uuid',
            lecturers: 'John Doe',
            description: 'Basic math'
          }
        ]
      });
    });
    
    it('should use empty string fallback if lecturer name is missing', async () => {
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 } as any);
      
      userRolesService.findAccountIdForRole.mockResolvedValue(20);

      const mockRawData = [
        {
          id: 1,
          name: 'Programming',
          image_ref: null,
          description: null,
          teacher_name: null,
          teacher_surname: null,
        }
      ];

      groupRepository.createQueryBuilder().getRawMany.mockResolvedValue(mockRawData);

      const result = await service.getUserGroups({} as any, 'browser-id');

      expect(result.groups[0].lecturers).toBe('');
    });
  });
});
