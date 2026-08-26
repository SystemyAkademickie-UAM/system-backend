import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource } from 'typeorm';

import { SessionService, type SessionSubject } from '../auth/session/session.service';
import { BacklogService } from '../backlog/backlog-service';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { StudentStatsEntity } from '../database/entities/student-stats.entity';
import { RanksService } from '../gamification/ranks-service';
import { GroupAuthorizationService } from '../groups/group-authorization.service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { StudentManagementService } from './student-management-service';

function mockSubject(userId: number): SessionSubject {
  return { userId, activeRole: null, sessionId: 1, organizationId: 1 };
}

describe('StudentManagementService', () => {
  let service: StudentManagementService;
  let sessionService: jest.Mocked<SessionService>;
  let userRolesService: jest.Mocked<UserRolesService>;
  let backlogService: { logEvent: jest.Mock };
  let groupRepository: { exist: jest.Mock };
  let enrollmentRepository: { exist: jest.Mock; findOne: jest.Mock };
  let studentStatsRepository: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let dataSource: { query: jest.Mock; createQueryRunner: jest.Mock };
  let ranksService: { calculateRankForPoints: jest.Mock };
  let groupAuthorizationService: { assertLecturerOwnsGroupFromRequest: jest.Mock };
  let mockQueryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      findOne: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
    };
  };

  const mockRequest = {} as Request;
  const groupId = 5;

  beforeEach(async () => {
    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        create: jest.fn((_, data) => data),
        save: jest.fn(async (entity) => entity),
      },
    };
    dataSource = {
      query: jest.fn(),
      createQueryRunner: jest.fn(() => mockQueryRunner),
    };
    groupRepository = { exist: jest.fn().mockResolvedValue(true) };
    enrollmentRepository = { exist: jest.fn(), findOne: jest.fn() };
    studentStatsRepository = {
      findOne: jest.fn(),
      create: jest.fn((_, data) => data),
      save: jest.fn(async (entity) => entity),
    };
    backlogService = { logEvent: jest.fn().mockResolvedValue({}) };
    ranksService = { calculateRankForPoints: jest.fn().mockResolvedValue(99) };
    groupAuthorizationService = {
      assertLecturerOwnsGroupFromRequest: jest.fn().mockResolvedValue(10),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentManagementService,
        { provide: SessionService, useValue: { resolveSubjectFromRequest: jest.fn() } },
        {
          provide: UserRolesService,
          useValue: { userHasRole: jest.fn(), findAccountIdForRole: jest.fn() },
        },
        { provide: BacklogService, useValue: backlogService },
        { provide: DataSource, useValue: dataSource },
        { provide: RanksService, useValue: ranksService },
        { provide: GroupAuthorizationService, useValue: groupAuthorizationService },
        { provide: getRepositoryToken(GroupEntity), useValue: groupRepository },
        { provide: getRepositoryToken(EnrollmentEntity), useValue: enrollmentRepository },
        { provide: getRepositoryToken(StudentStatsEntity), useValue: studentStatsRepository },
      ],
    }).compile();

    service = module.get(StudentManagementService);
    sessionService = module.get(SessionService);
    userRolesService = module.get(UserRolesService);
  });

  describe('getParticipants', () => {
    it('should throw UnauthorizedException when session is missing', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(null);

      await expect(service.getParticipants(mockRequest, groupId)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when caller is neither owner nor enrolled', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.findAccountIdForRole.mockResolvedValue(null);
      enrollmentRepository.exist.mockResolvedValue(false);

      await expect(service.getParticipants(mockRequest, groupId)).rejects.toThrow(ForbiddenException);
    });

    it('should return participant rows for enrolled student', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.findAccountIdForRole.mockImplementation(async (_userId, role) =>
        role === STUDENT_ROLE_NAME ? 20 : null,
      );
      enrollmentRepository.exist.mockResolvedValue(true);
      dataSource.query.mockResolvedValue([
        { accountId: 20, nickname: 'hero', avatarUrl: null, name: 'Jan', surname: 'Kowalski' },
      ]);

      const actualRows = await service.getParticipants(mockRequest, groupId);

      expect(actualRows).toHaveLength(1);
      expect(dataSource.query).toHaveBeenCalled();
    });
  });

  describe('bulkUpdate', () => {
    beforeEach(() => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      groupAuthorizationService.assertLecturerOwnsGroupFromRequest.mockResolvedValue(10);
      mockQueryRunner.manager.findOne.mockImplementation(async (entity, options) => {
        if (entity === EnrollmentEntity) {
          return { id: options.where.enrollmentId, groupId, studentAccountId: 1 };
        }
        return {
          enrollmentId: 1,
          currency: 0,
          totalEarned: 100,
          rankId: 1,
          autoRankEnabled: true,
        };
      });
    });

    it('should disable auto rank and keep manual rankId when rankId is sent without autoRankEnabled', async () => {
      const savedStats: StudentStatsEntity[] = [];
      mockQueryRunner.manager.save.mockImplementation(async (_entity, data) => {
        savedStats.push(data);
        return data;
      });

      const actualResult = await service.bulkUpdate(mockRequest, groupId, {
        students: [{ enrollmentId: 1, rankId: 7 }],
      });

      expect(actualResult.updated).toBe(1);
      expect(savedStats[0].rankId).toBe(7);
      expect(savedStats[0].autoRankEnabled).toBe(false);
      expect(ranksService.calculateRankForPoints).not.toHaveBeenCalled();
    });

    it('should recalculate rank when autoRankEnabled is true', async () => {
      const savedStats: StudentStatsEntity[] = [];
      mockQueryRunner.manager.save.mockImplementation(async (_entity, data) => {
        savedStats.push(data);
        return data;
      });

      await service.bulkUpdate(mockRequest, groupId, {
        students: [{ enrollmentId: 1, autoRankEnabled: true, totalEarned: 500 }],
      });

      expect(ranksService.calculateRankForPoints).toHaveBeenCalledWith(groupId, 500);
      expect(savedStats[0].rankId).toBe(99);
      expect(savedStats[0].autoRankEnabled).toBe(true);
    });

    it('should throw ForbiddenException when lecturer does not own the group', async () => {
      groupAuthorizationService.assertLecturerOwnsGroupFromRequest.mockRejectedValue(
        new ForbiddenException('Not authorized to manage this group'),
      );

      await expect(
        service.bulkUpdate(mockRequest, groupId, {
          students: [{ enrollmentId: 1, rankId: 7 }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('lives management', () => {
    beforeEach(() => {
      groupAuthorizationService.assertLecturerOwnsGroupFromRequest.mockResolvedValue(10);
      enrollmentRepository.findOne.mockResolvedValue({ id: 10, groupId, studentAccountId: 20 });
    });

    it('should increment lives by 1 and log event', async () => {
      studentStatsRepository.findOne.mockResolvedValue({ enrollmentId: 10, lives: 3 });
      const result = await service.incrementLives(mockRequest, groupId, 20);

      expect(result.lives).toBe(4);
      expect(studentStatsRepository.save).toHaveBeenCalledWith(expect.objectContaining({ lives: 4 }));
      expect(backlogService.logEvent).toHaveBeenCalledWith(
        groupId,
        20,
        'LIVES_CHANGED',
        expect.objectContaining({ lives: 4, delta: 1 }),
      );
    });

    it('should decrement lives by 1 not falling below 0', async () => {
      studentStatsRepository.findOne.mockResolvedValue({ enrollmentId: 10, lives: 0 });
      const result = await service.decrementLives(mockRequest, groupId, 20);

      expect(result.lives).toBe(0);
      expect(studentStatsRepository.save).toHaveBeenCalledWith(expect.objectContaining({ lives: 0 }));
    });
  });

  describe('bulkUpdateLives', () => {
    beforeEach(() => {
      groupAuthorizationService.assertLecturerOwnsGroupFromRequest.mockResolvedValue(10);
      groupRepository.exist.mockResolvedValue(true);
    });

    it('should update lives for multiple students respecting livesMax cap', async () => {
      groupRepository.exist.mockResolvedValue(true);
      // Return group with livesMax = 5
      mockQueryRunner.manager.findOne.mockImplementation(async (entity, options) => {
        if (entity === EnrollmentEntity) {
          return { id: options.where.studentAccountId * 10, groupId, studentAccountId: options.where.studentAccountId };
        }
        return { enrollmentId: options.where.enrollmentId, lives: 4 };
      });

      // Spy on groupRepository to return livesMax
      groupRepository.exist.mockResolvedValue(true);
      jest.spyOn(service as never, 'assertLecturerOwnsGroup').mockResolvedValue(undefined as never);

      const savedStats: { lives: number }[] = [];
      mockQueryRunner.manager.save.mockImplementation(async (_entity, data) => {
        savedStats.push(data);
        return data;
      });

      // accountId=20 has 4 lives, delta=+3 → capped at 5; accountId=30 has 4 lives, delta=-2 → 2
      const inputStudents = [
        { accountId: 20, delta: 3 },
        { accountId: 30, delta: -2 },
      ];

      // Re-mock findOne to return group
      const originalFindOne = mockQueryRunner.manager.findOne;
      mockQueryRunner.manager.findOne.mockImplementation(async (entity, options) => {
        if (entity === EnrollmentEntity) {
          const accountId = options.where.studentAccountId as number;
          return { id: accountId * 10, groupId, studentAccountId: accountId };
        }
        return { enrollmentId: (options.where.enrollmentId as number), lives: 4 };
      });

      const module2 = await (await import('@nestjs/testing')).Test.createTestingModule({
        providers: [
          StudentManagementService,
          { provide: SessionService, useValue: { resolveSubjectFromRequest: jest.fn() } },
          { provide: UserRolesService, useValue: { userHasRole: jest.fn(), findAccountIdForRole: jest.fn() } },
          { provide: BacklogService, useValue: backlogService },
          { provide: DataSource, useValue: dataSource },
          { provide: RanksService, useValue: ranksService },
          { provide: GroupAuthorizationService, useValue: groupAuthorizationService },
          { provide: getRepositoryToken(GroupEntity), useValue: { ...groupRepository, findOne: jest.fn().mockResolvedValue({ id: groupId, lives: 5 }) } },
          { provide: getRepositoryToken(EnrollmentEntity), useValue: enrollmentRepository },
          { provide: getRepositoryToken(StudentStatsEntity), useValue: studentStatsRepository },
        ],
      }).compile();

      const service2 = module2.get(StudentManagementService);
      const result = await service2.bulkUpdateLives(mockRequest, groupId, { students: inputStudents });

      expect(result.results).toHaveLength(2);
      // accountId=20: 4+3=7 → capped to 5
      expect(result.results[0]).toEqual({ accountId: 20, lives: 5 });
      // accountId=30: 4-2=2 → 2 (no cap needed)
      expect(result.results[1]).toEqual({ accountId: 30, lives: 2 });
    });

    it('should clamp lives to 0 when negative delta exceeds current lives', async () => {
      mockQueryRunner.manager.findOne.mockImplementation(async (entity, options) => {
        if (entity === EnrollmentEntity) {
          return { id: 100, groupId, studentAccountId: options.where.studentAccountId };
        }
        return { enrollmentId: 100, lives: 1 };
      });

      const savedStats: { lives: number }[] = [];
      mockQueryRunner.manager.save.mockImplementation(async (_entity, data) => {
        savedStats.push(data);
        return data;
      });

      const module3 = await (await import('@nestjs/testing')).Test.createTestingModule({
        providers: [
          StudentManagementService,
          { provide: SessionService, useValue: { resolveSubjectFromRequest: jest.fn() } },
          { provide: UserRolesService, useValue: { userHasRole: jest.fn(), findAccountIdForRole: jest.fn() } },
          { provide: BacklogService, useValue: backlogService },
          { provide: DataSource, useValue: dataSource },
          { provide: RanksService, useValue: ranksService },
          { provide: GroupAuthorizationService, useValue: groupAuthorizationService },
          { provide: getRepositoryToken(GroupEntity), useValue: { exist: jest.fn().mockResolvedValue(true), findOne: jest.fn().mockResolvedValue({ id: groupId, lives: null }) } },
          { provide: getRepositoryToken(EnrollmentEntity), useValue: enrollmentRepository },
          { provide: getRepositoryToken(StudentStatsEntity), useValue: studentStatsRepository },
        ],
      }).compile();

      const service3 = module3.get(StudentManagementService);
      const result = await service3.bulkUpdateLives(mockRequest, groupId, {
        students: [{ accountId: 20, delta: -99 }],
      });

      expect(result.results[0].lives).toBe(0);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should skip unknown accountId and process the rest', async () => {
      let callCount = 0;
      mockQueryRunner.manager.findOne.mockImplementation(async (entity, options) => {
        if (entity === EnrollmentEntity) {
          callCount++;
          // First call (accountId=999) returns null → not enrolled
          if (options.where.studentAccountId === 999) return null;
          return { id: 200, groupId, studentAccountId: options.where.studentAccountId };
        }
        return { enrollmentId: 200, lives: 2 };
      });

      mockQueryRunner.manager.save.mockImplementation(async (_entity, data) => data);

      const module4 = await (await import('@nestjs/testing')).Test.createTestingModule({
        providers: [
          StudentManagementService,
          { provide: SessionService, useValue: { resolveSubjectFromRequest: jest.fn() } },
          { provide: UserRolesService, useValue: { userHasRole: jest.fn(), findAccountIdForRole: jest.fn() } },
          { provide: BacklogService, useValue: backlogService },
          { provide: DataSource, useValue: dataSource },
          { provide: RanksService, useValue: ranksService },
          { provide: GroupAuthorizationService, useValue: groupAuthorizationService },
          { provide: getRepositoryToken(GroupEntity), useValue: { exist: jest.fn().mockResolvedValue(true), findOne: jest.fn().mockResolvedValue({ id: groupId, lives: null }) } },
          { provide: getRepositoryToken(EnrollmentEntity), useValue: enrollmentRepository },
          { provide: getRepositoryToken(StudentStatsEntity), useValue: studentStatsRepository },
        ],
      }).compile();

      const service4 = module4.get(StudentManagementService);
      const result = await service4.bulkUpdateLives(mockRequest, groupId, {
        students: [
          { accountId: 999, delta: 1 },  // not enrolled → skipped
          { accountId: 20, delta: 1 },   // enrolled → processed
        ],
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].accountId).toBe(20);
    });

    it('should throw ForbiddenException when lecturer does not own the group', async () => {
      groupAuthorizationService.assertLecturerOwnsGroupFromRequest.mockRejectedValue(
        new (await import('@nestjs/common')).ForbiddenException('Not authorized'),
      );

      await expect(
        service.bulkUpdateLives(mockRequest, groupId, { students: [{ accountId: 20, delta: 1 }] }),
      ).rejects.toThrow((await import('@nestjs/common')).ForbiddenException);
    });
  });
});
