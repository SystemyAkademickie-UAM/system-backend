import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, In } from 'typeorm';

import { SessionService, type SessionSubject } from '../auth/session/session.service';
import {
  STAGE_API_JSON_STATUS_FORBIDDEN,
  STAGE_API_JSON_STATUS_OK,
  STAGE_RESPONSE_NOT_AUTHORIZED_ID,
} from '../constants/stage-api-constants';
import { GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { ActivityBacklogEntity } from '../database/entities/activity-backlog.entity';
import { ActivityEntity } from '../database/entities/activity.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { StageEntity } from '../database/entities/stage.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { BacklogService } from '../backlog/backlog-service';
import { GroupAuthorizationService } from '../groups/group-authorization.service';
import { StagesService } from './stages-service';

function mockSubject(userId: number): SessionSubject {
  return { userId, activeRole: null, sessionId: 1, organizationId: 1 };
}

describe('StagesService', () => {
  let service: StagesService;
  let sessionService: jest.Mocked<SessionService>;
  let userRolesService: jest.Mocked<UserRolesService>;
  let groupRepository: { exist: jest.Mock };
  let stageRepository: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock; delete: jest.Mock; update: jest.Mock };
  let groupAuthorizationService: { assertLecturerOwnsGroup: jest.Mock; isLecturerOwner: jest.Mock };
  let mockManager: { update: jest.Mock; find: jest.Mock; delete: jest.Mock };
  let mockQueryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: { update: jest.Mock };
  };
  let dataSource: { createQueryRunner: jest.Mock };

  const mockRequest = {} as Request;
  const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;

  beforeEach(async () => {
    mockManager = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: mockManager,
    };
    dataSource = { createQueryRunner: jest.fn(() => mockQueryRunner) };
    groupRepository = { exist: jest.fn() };
    groupAuthorizationService = {
      assertLecturerOwnsGroup: jest.fn().mockResolvedValue(10),
      isLecturerOwner: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StagesService,
        { provide: SessionService, useValue: { resolveSubjectFromRequest: jest.fn() } },
        {
          provide: UserRolesService,
          useValue: { userHasRole: jest.fn(), findAccountIdForRole: jest.fn() },
        },
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(StageEntity), useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), delete: jest.fn(), update: jest.fn() } },
        { provide: getRepositoryToken(GroupEntity), useValue: groupRepository },
        {
          provide: BacklogService,
          useValue: {
            notifyEnrolledStudents: jest.fn().mockResolvedValue(undefined),
            logEvent: jest.fn().mockResolvedValue({}),
          },
        },
        { provide: GroupAuthorizationService, useValue: groupAuthorizationService },
      ],
    }).compile();

    service = module.get(StagesService);
    sessionService = module.get(SessionService);
    userRolesService = module.get(UserRolesService);
    stageRepository = module.get(getRepositoryToken(StageEntity));
  });

  describe('handleStage reorder', () => {
    it('should deny reorder when lecturer does not own the group', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.userHasRole.mockResolvedValue(true);
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      groupAuthorizationService.assertLecturerOwnsGroup.mockRejectedValue(
        new ForbiddenException('Not authorized to manage this group'),
      );

      const actualResult = await service.handleStage(mockRequest, {
        auth: 'token',
        method: 'reorder',
        groupId: publicGroupId,
        stageIds: [1, 2],
      });

      expect(actualResult).toEqual({
        statusCode: STAGE_API_JSON_STATUS_FORBIDDEN,
        method: 'reorder',
        stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID,
      });
      expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
    });

    it('should reorder stages in a transaction when lecturer owns the group', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.userHasRole.mockResolvedValue(true);
      userRolesService.findAccountIdForRole.mockImplementation(async (_userId, role) =>
        role === LECTURER_ROLE_NAME ? 10 : null,
      );
      groupAuthorizationService.assertLecturerOwnsGroup.mockResolvedValue(10);

      const actualResult = await service.handleStage(mockRequest, {
        auth: 'token',
        method: 'reorder',
        groupId: publicGroupId,
        stageIds: [11, 12],
      });

      expect(actualResult).toEqual({
        statusCode: STAGE_API_JSON_STATUS_OK,
        method: 'reorder',
        stage: 2,
      });
      expect(mockManager.update).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('handleStage remove', () => {
    it('should delete an empty stage', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.userHasRole.mockResolvedValue(true);
      stageRepository.findOne.mockResolvedValue({ id: 4, groupId: 5, name: 'Empty' });
      mockManager.find.mockResolvedValue([]);

      const actualResult = await service.handleStage(mockRequest, {
        auth: 'token',
        method: 'remove',
        stageId: 4,
      });

      expect(actualResult).toEqual({
        statusCode: STAGE_API_JSON_STATUS_OK,
        method: 'remove',
        stage: 4,
      });
      expect(mockManager.delete).toHaveBeenCalledTimes(1);
      expect(mockManager.delete).toHaveBeenCalledWith(StageEntity, { id: 4 });
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should delete a stage together with its activities and completion rows', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.userHasRole.mockResolvedValue(true);
      stageRepository.findOne.mockResolvedValue({ id: 4, groupId: 5, name: 'Filled' });
      mockManager.find.mockResolvedValue([{ id: 21 }, { id: 22 }]);

      const actualResult = await service.handleStage(mockRequest, {
        auth: 'token',
        method: 'remove',
        stageId: 4,
      });

      expect(actualResult).toEqual({
        statusCode: STAGE_API_JSON_STATUS_OK,
        method: 'remove',
        stage: 4,
      });
      expect(mockManager.delete).toHaveBeenNthCalledWith(1, ActivityBacklogEntity, {
        activityId: In([21, 22]),
      });
      expect(mockManager.delete).toHaveBeenNthCalledWith(2, ActivityEntity, { stageId: 4 });
      expect(mockManager.delete).toHaveBeenNthCalledWith(3, StageEntity, { id: 4 });
    });
  });
});
