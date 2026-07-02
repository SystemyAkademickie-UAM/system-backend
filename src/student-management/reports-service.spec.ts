import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';

import { SessionService, type SessionSubject } from '../auth/session/session.service';
import { DataSource } from 'typeorm';
import { ActivityBacklogEntity } from '../database/entities/activity-backlog.entity';
import { ActivityEntity } from '../database/entities/activity.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { StageEntity } from '../database/entities/stage.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { ReportsService } from './reports-service';

function mockSubject(userId: number): SessionSubject {
  return { userId, activeRole: null, sessionId: 1, organizationId: 1 };
}

describe('ReportsService', () => {
  let service: ReportsService;
  let sessionService: jest.Mocked<SessionService>;
  let userRolesService: jest.Mocked<UserRolesService>;
  let dataSourceQueryMock: jest.Mock;
  let groupRepository: any;
  let stageRepository: any;
  let enrollmentRepository: any;

  const mockRequest = {} as Request;

  beforeEach(async () => {
    dataSourceQueryMock = jest.fn();
    const mockSessionService = {
      resolveSubjectFromRequest: jest.fn(),
    };
    const mockUserRolesService = {
      userHasRole: jest.fn(),
      findAccountIdForRole: jest.fn(),
    };
    groupRepository = { exist: jest.fn() };
    stageRepository = { exist: jest.fn() };
    enrollmentRepository = { exist: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: SessionService, useValue: mockSessionService },
        { provide: UserRolesService, useValue: mockUserRolesService },
        {
          provide: DataSource,
          useValue: { query: dataSourceQueryMock },
        },
        { provide: getRepositoryToken(GroupEntity), useValue: groupRepository },
        { provide: getRepositoryToken(StageEntity), useValue: stageRepository },
        { provide: getRepositoryToken(EnrollmentEntity), useValue: enrollmentRepository },
        { provide: getRepositoryToken(ActivityEntity), useValue: {} },
        { provide: getRepositoryToken(ActivityBacklogEntity), useValue: {} },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    sessionService = module.get(SessionService);
    userRolesService = module.get(UserRolesService);
  });

  describe('Authorization checks', () => {
    it('should throw ForbiddenException if no subject is resolved', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(null);
      await expect(service.generateGroupReport(mockRequest, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user lacks lecturer role', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.userHasRole.mockResolvedValue(false);
      await expect(service.generateGroupReport(mockRequest, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if lecturer is not group owner', async () => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.userHasRole.mockResolvedValue(true);
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      groupRepository.exist.mockResolvedValue(false);
      await expect(service.generateGroupReport(mockRequest, 1)).rejects.toThrow(
        'Not authorized to manage this group',
      );
    });
  });

  describe('generateGroupReport', () => {
    beforeEach(() => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.userHasRole.mockResolvedValue(true);
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      groupRepository.exist.mockResolvedValue(true);
    });

    it('should build CSV with matrix of all students and activities', async () => {
      dataSourceQueryMock.mockImplementation(async (sql) => {
        if (sql.includes('gamification.enrollments')) {
          return [
            { accountId: 101, name: 'Jan', surname: 'Kowalski', nickname: 'jkowal' },
            { accountId: 102, name: 'Anna', surname: 'Nowak', nickname: '' },
          ];
        }
        if (sql.includes('education.activities')) {
          return [
            { stageId: 1, stageName: 'Stage 1', activityId: 10, activityName: 'Act 1' },
            { stageId: 1, stageName: 'Stage 1', activityId: 20, activityName: 'Act 2' },
          ];
        }
        if (sql.includes('analytics.activity_backlog')) {
          return [
            { account_id: 101, activity_id: 10 },
            { account_id: 102, activity_id: 20 },
          ];
        }
        return [];
      });

      const csv = await service.generateGroupReport(mockRequest, 1);
      
      expect(csv).toContain('Student;Stage 1 > Act 1;Stage 1 > Act 2');
      expect(csv).toContain('Kowalski Jan (jkowal);1;0');
      expect(csv).toContain('Nowak Anna;0;1');
    });
  });

  describe('generateStageReport', () => {
    beforeEach(() => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.userHasRole.mockResolvedValue(true);
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      groupRepository.exist.mockResolvedValue(true);
      stageRepository.exist.mockResolvedValue(true);
    });

    it('should throw NotFoundException if stage is not in group', async () => {
      stageRepository.exist.mockResolvedValue(false);
      await expect(service.generateStageReport(mockRequest, 1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should build CSV restricted to one stage', async () => {
      dataSourceQueryMock.mockImplementation(async (sql) => {
        if (sql.includes('gamification.enrollments')) {
          return [{ accountId: 101, name: 'Jan', surname: 'Kowalski', nickname: '' }];
        }
        if (sql.includes('education.activities')) {
          return [{ stageId: 2, stageName: 'Stage 2', activityId: 30, activityName: 'Act 3' }];
        }
        if (sql.includes('analytics.activity_backlog')) {
          return [{ account_id: 101, activity_id: 30 }];
        }
        return [];
      });

      const csv = await service.generateStageReport(mockRequest, 1, 2);
      
      expect(csv).toContain('Student;Stage 2 > Act 3');
      expect(csv).toContain('Kowalski Jan;1');
    });
  });

  describe('generateStudentReport', () => {
    beforeEach(() => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue(mockSubject(1));
      userRolesService.userHasRole.mockResolvedValue(true);
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      groupRepository.exist.mockResolvedValue(true);
      enrollmentRepository.exist.mockResolvedValue(true);
    });

    it('should throw NotFoundException if student is not enrolled', async () => {
      enrollmentRepository.exist.mockResolvedValue(false);
      await expect(service.generateStudentReport(mockRequest, 1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if query returns 0 students', async () => {
      dataSourceQueryMock.mockResolvedValue([]);
      await expect(service.generateStudentReport(mockRequest, 1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should build flat CSV for single student', async () => {
      dataSourceQueryMock.mockImplementation(async (sql) => {
        if (sql.includes('gamification.enrollments')) {
          return [{ accountId: 101, name: 'Jan', surname: 'Kowalski', nickname: '' }];
        }
        if (sql.includes('education.activities')) {
          return [
            { stageId: 1, stageName: 'Stage 1', activityId: 10, activityName: 'Act 1' },
            { stageId: 2, stageName: 'Stage 2', activityId: 20, activityName: 'Act 2' },
          ];
        }
        if (sql.includes('analytics.activity_backlog')) {
          return [{ account_id: 101, activity_id: 10 }];
        }
        return [];
      });

      const csv = await service.generateStudentReport(mockRequest, 1, 101);
      
      expect(csv).toContain('Student;Stage;Activity;Completed');
      expect(csv).toContain('Kowalski Jan;Stage 1;Act 1;1');
      expect(csv).toContain('Kowalski Jan;Stage 2;Act 2;0');
    });
  });
});
