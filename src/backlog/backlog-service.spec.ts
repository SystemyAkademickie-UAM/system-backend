import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';

import { BacklogService } from './backlog-service';
import { BacklogEntity } from '../database/entities/backlog.entity';
import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';

describe('BacklogService', () => {
  let service: BacklogService;
  let backlogRepository: any;
  let authTokenSessionService: any;
  let userRolesService: any;

  beforeEach(async () => {
    backlogRepository = {
      find: jest.fn(),
    };
    authTokenSessionService = {
      resolveSubjectStrongFromRequest: jest.fn(),
    };
    userRolesService = {
      findAccountIdForRole: jest.fn(),
      resolvePrimaryRoleForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BacklogService,
        {
          provide: getRepositoryToken(BacklogEntity),
          useValue: backlogRepository,
        },
        {
          provide: AuthTokenSessionService,
          useValue: authTokenSessionService,
        },
        {
          provide: UserRolesService,
          useValue: userRolesService,
        },
      ],
    }).compile();

    service = module.get<BacklogService>(BacklogService);
  });

  describe('getStudentBacklog', () => {
    it('should return error if unauthorized', async () => {
      // Arrange
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue(null);

      // Act
      const result = await service.getStudentBacklog({} as Request, 1, 'browser-id');

      // Assert
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return error if student account not found', async () => {
      // Arrange
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.findAccountIdForRole.mockResolvedValue(null);

      // Act
      const result = await service.getStudentBacklog({} as Request, 1, 'browser-id');

      // Assert
      expect(result).toEqual({ error: 'Student account not found' });
    });

    it('should return backlog items for valid student', async () => {
      // Arrange
      const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;
      const internalGroupId = 5;
      const studentAccountId = 10;
      const mockDate = new Date();
      
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.findAccountIdForRole.mockResolvedValue(studentAccountId);
      
      const mockEntries = [
        { id: 1, groupId: internalGroupId, accountId: studentAccountId, type: 'SHOP_PURCHASE', date: mockDate, value: 'item_1' },
      ];
      backlogRepository.find.mockResolvedValue(mockEntries);

      // Act
      const result = await service.getStudentBacklog({} as Request, publicGroupId, 'browser-id');

      // Assert
      expect(backlogRepository.find).toHaveBeenCalledWith({
        where: { groupId: internalGroupId, accountId: studentAccountId },
        order: { date: 'DESC' },
      });
      expect(result).toEqual([
        { id: 1, type: 'SHOP_PURCHASE', date: mockDate.toISOString(), value: 'item_1', accountId: studentAccountId },
      ]);
    });
  });

  describe('getGroupBacklog', () => {
    it('should return error if unauthorized', async () => {
      // Arrange
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue(null);

      // Act
      const result = await service.getGroupBacklog({} as Request, 1, 'browser-id');

      // Assert
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return error if user is not lecturer', async () => {
      // Arrange
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('student');

      // Act
      const result = await service.getGroupBacklog({} as Request, 1, 'browser-id');

      // Assert
      expect(result).toEqual({ error: 'Forbidden: Requires lecturer privileges' });
    });

    it('should return group backlog items for valid lecturer', async () => {
      // Arrange
      const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;
      const internalGroupId = 5;
      const mockDate = new Date();
      
      authTokenSessionService.resolveSubjectStrongFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('lecturer');
      
      const mockEntries = [
        { id: 1, groupId: internalGroupId, accountId: 10, type: 'SHOP_PURCHASE', date: mockDate, value: 'item_1' },
      ];
      backlogRepository.find.mockResolvedValue(mockEntries);

      // Act
      const result = await service.getGroupBacklog({} as Request, publicGroupId, 'browser-id');

      // Assert
      expect(backlogRepository.find).toHaveBeenCalledWith({
        where: { groupId: internalGroupId },
        order: { date: 'DESC' },
      });
      expect(result).toEqual([
        { id: 1, type: 'SHOP_PURCHASE', date: mockDate.toISOString(), value: 'item_1', accountId: 10 },
      ]);
    });
  });
});
