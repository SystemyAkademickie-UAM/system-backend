import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';
import { ActivitiesService } from './activities-service';
import { SessionService } from '../auth/session/session.service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { ActivityEntity } from '../database/entities/activity.entity';
import { StageEntity } from '../database/entities/stage.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { ActivityBacklogEntity } from '../database/entities/activity-backlog.entity';

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let activityRepository: any;
  let stageRepository: any;
  let activityBacklogRepository: any;
  let sessionService: any;
  let userRolesService: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    sessionService = {
      resolveSubjectFromRequest: jest.fn().mockResolvedValue({ userId: 1 }),
    };
    userRolesService = {
      findAccountIdForRole: jest.fn().mockResolvedValue(10), // Lecturer
      userHasRole: jest.fn().mockResolvedValue(true),
    };
    
    activityRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    
    stageRepository = {
      find: jest.fn(),
    };
    
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };
    
    activityBacklogRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: SessionService, useValue: sessionService },
        { provide: UserRolesService, useValue: userRolesService },
        { provide: getRepositoryToken(ActivityEntity), useValue: activityRepository },
        { provide: getRepositoryToken(StageEntity), useValue: stageRepository },
        { provide: getRepositoryToken(GroupEntity), useValue: {} },
        { provide: getRepositoryToken(ActivityBacklogEntity), useValue: activityBacklogRepository },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
  });

  describe('retrieveActivities', () => {
    it('should attach completionCount from backlog correctly', async () => {
      // Setup mock activities
      activityRepository.find.mockResolvedValue([
        { id: 1, stageId: 10, name: 'Activity 1', currency: 100, educationalDescription: '', storyDescription: '' },
        { id: 2, stageId: 10, name: 'Activity 2', currency: 50, educationalDescription: '', storyDescription: '' },
        { id: 3, stageId: 10, name: 'Activity 3', currency: 25, educationalDescription: '', storyDescription: '' },
      ]);
      
      // Setup raw counts from Postgres driver (strings)
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { activityId: '1', count: '5' },
        { activityId: '2', count: '10' },
        // activity 3 has no backlog row
      ]);
      
      const req = {} as Request;
      const result = await service.handleActivity(req, { method: 'retrieve' });
      
      expect(result.statusCode).toBe(200);
      expect(result.activities).toBeDefined();
      
      const activities = result.activities!;
      expect(activities.length).toBe(3);
      
      const act1 = activities.find(a => a.id === 1);
      expect(act1?.completionCount).toBe(5);
      
      const act2 = activities.find(a => a.id === 2);
      expect(act2?.completionCount).toBe(10);
      
      const act3 = activities.find(a => a.id === 3);
      expect(act3?.completionCount).toBe(0); // fallback to 0
    });
  });
});
