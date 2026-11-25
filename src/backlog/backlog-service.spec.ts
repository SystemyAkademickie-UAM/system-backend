import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import type { Request } from 'express';

import { BacklogService } from './backlog-service';
import { BacklogEntity } from '../database/entities/backlog.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { AccountEntity } from '../database/entities/account.entity';
import { UserEntity } from '../database/entities/user.entity';
import { SessionService } from '../auth/session/session.service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';
import { STUDENT_ROLE_NAME, LECTURER_ROLE_NAME } from '../constants/role-name-constants';

describe('BacklogService', () => {
  let service: BacklogService;
  let backlogRepository: any;
  let groupRepository: any;
  let enrollmentRepository: any;
  let accountRepository: any;
  let userRepository: any;
  let sessionService: any;
  let userRolesService: any;

  beforeEach(async () => {
    backlogRepository = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    groupRepository = {
      exist: jest.fn(),
    };
    enrollmentRepository = {
      exist: jest.fn(),
      find: jest.fn(),
    };
    accountRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    userRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    sessionService = {
      resolveSubjectFromRequest: jest.fn(),
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
          provide: getRepositoryToken(GroupEntity),
          useValue: groupRepository,
        },
        {
          provide: getRepositoryToken(EnrollmentEntity),
          useValue: enrollmentRepository,
        },
        {
          provide: getRepositoryToken(AccountEntity),
          useValue: accountRepository,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: userRepository,
        },
        {
          provide: SessionService,
          useValue: sessionService,
        },
        {
          provide: UserRolesService,
          useValue: userRolesService,
        },
      ],
    }).compile();

    service = module.get<BacklogService>(BacklogService);
  });

  describe('logEvent', () => {
    it('should create and save a new backlog entry', async () => {
      // Arrange
      const mockEntry = { groupId: 5, accountId: 10, type: 'SHOP_PURCHASE', value: 'item_1' };
      const savedEntry = { id: 1, ...mockEntry, date: new Date() };
      
      backlogRepository.create.mockReturnValue(mockEntry);
      backlogRepository.save.mockResolvedValue(savedEntry);

      // Act
      const result = await service.logEvent(5, 10, 'SHOP_PURCHASE', 'item_1');

      // Assert
      expect(backlogRepository.create).toHaveBeenCalledWith({
        groupId: 5,
        accountId: 10,
        type: 'SHOP_PURCHASE',
        date: expect.any(Date),
        value: 'item_1',
      });
      expect(backlogRepository.save).toHaveBeenCalledWith(mockEntry);
      expect(result).toEqual(savedEntry);
    });

    it('should handle null value gracefully', async () => {
      // Arrange
      const mockEntry = { groupId: 5, accountId: 10, type: 'ITEM_USED', value: null };
      
      backlogRepository.create.mockReturnValue(mockEntry);
      backlogRepository.save.mockResolvedValue({ id: 2, ...mockEntry });

      // Act
      await service.logEvent(5, 10, 'ITEM_USED');

      // Assert
      expect(backlogRepository.create).toHaveBeenCalledWith({
        groupId: 5,
        accountId: 10,
        type: 'ITEM_USED',
        date: expect.any(Date),
        value: null,
      });
    });

    it('should propagate database constraint errors (e.g., invalid groupId)', async () => {
      // Arrange
      const mockEntry = { groupId: 9999, accountId: 10, type: 'SHOP_PURCHASE', value: null };
      
      backlogRepository.create.mockReturnValue(mockEntry);
      backlogRepository.save.mockRejectedValue(new Error('Foreign key violation'));

      // Act & Assert
      await expect(service.logEvent(9999, 10, 'SHOP_PURCHASE')).rejects.toThrow('Foreign key violation');
    });

    it('should use manager.getRepository when EntityManager is provided', async () => {
      // Arrange
      const mockEntry = { groupId: 5, accountId: 10, type: 'SHOP_PURCHASE', value: 'item_1' };
      const savedEntry = { id: 3, ...mockEntry, date: new Date() };

      const managerRepo = {
        create: jest.fn().mockReturnValue(mockEntry),
        save: jest.fn().mockResolvedValue(savedEntry),
      };

      const mockManager = {
        getRepository: jest.fn().mockReturnValue(managerRepo),
      } as unknown as import('typeorm').EntityManager;

      // Act
      const result = await service.logEvent(5, 10, 'SHOP_PURCHASE', 'item_1', mockManager);

      // Assert — manager.getRepository was called with BacklogEntity
      expect(mockManager.getRepository).toHaveBeenCalledWith(BacklogEntity);

      // Assert — create/save ran on the manager's repo, NOT the default injected repo
      expect(managerRepo.create).toHaveBeenCalledWith({
        groupId: 5,
        accountId: 10,
        type: 'SHOP_PURCHASE',
        date: expect.any(Date),
        value: 'item_1',
      });
      expect(managerRepo.save).toHaveBeenCalledWith(mockEntry);
      expect(result).toEqual(savedEntry);

      // Assert — the default backlogRepository was NOT used
      expect(backlogRepository.create).not.toHaveBeenCalled();
      expect(backlogRepository.save).not.toHaveBeenCalled();
    });

    it('should skip account and user queries when full student identity is already present in payload', async () => {
      // Arrange
      const payload = {
        badgeId: 1,
        studentNickname: 'Kasia',
        studentName: 'Katarzyna',
        studentSurname: 'Kowalska',
      };
      const mockEntry = { groupId: 5, accountId: 10, type: 'BADGE_EARNED', value: JSON.stringify(payload) };
      backlogRepository.create.mockReturnValue(mockEntry);
      backlogRepository.save.mockResolvedValue(mockEntry);

      // Act
      await service.logEvent(5, 10, 'BADGE_EARNED', payload);

      // Assert
      expect(accountRepository.findOne).not.toHaveBeenCalled();
      expect(userRepository.findOne).not.toHaveBeenCalled();
      expect(backlogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: 5,
          accountId: 10,
          type: 'BADGE_EARNED',
          value: expect.stringContaining('"studentNickname":"Kasia"'),
        }),
      );
      const createdPayload = JSON.parse(backlogRepository.create.mock.calls[0][0].value);
      expect(createdPayload).toMatchObject({
        studentNickname: 'Kasia',
        studentName: 'Katarzyna',
        studentSurname: 'Kowalska',
      });
    });

    it('should query account and user when studentNickname, studentName, or studentSurname is missing in payload', async () => {
      // Arrange
      accountRepository.findOne.mockResolvedValue({ userId: 42 });
      userRepository.findOne.mockResolvedValue({ nickname: 'Adam', name: 'Adam', surname: 'Nowak' });
      const mockEntry = { groupId: 5, accountId: 10, type: 'BADGE_EARNED', value: null };
      backlogRepository.create.mockReturnValue(mockEntry);
      backlogRepository.save.mockResolvedValue(mockEntry);

      // Act
      await service.logEvent(5, 10, 'BADGE_EARNED', { badgeId: 1 });

      // Assert
      expect(accountRepository.findOne).toHaveBeenCalledWith({ where: { id: 10 }, select: ['userId'] });
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 42 }, select: ['nickname', 'name', 'surname'] });
      const createdPayload = JSON.parse(backlogRepository.create.mock.calls[0][0].value);
      expect(createdPayload).toMatchObject({
        badgeId: 1,
        studentNickname: 'Adam',
        studentName: 'Adam',
        studentSurname: 'Nowak',
      });
    });

    it('should preserve existing payload studentNickname while completing missing studentName and studentSurname', async () => {
      // Arrange
      accountRepository.findOne.mockResolvedValue({ userId: 42 });
      userRepository.findOne.mockResolvedValue({ nickname: 'StaryNick', name: 'Anna', surname: 'Zielińska' });
      backlogRepository.create.mockImplementation((entry: any) => entry);
      backlogRepository.save.mockImplementation(async (entry: any) => entry);

      // Act
      await service.logEvent(5, 10, 'SHOP_PURCHASE', { itemName: 'Mikstura', studentNickname: 'Ania' });

      // Assert
      const createdPayload = JSON.parse(backlogRepository.create.mock.calls[0][0].value);
      expect(createdPayload).toEqual({
        itemName: 'Mikstura',
        studentNickname: 'Ania',
        studentName: 'Anna',
        studentSurname: 'Zielińska',
      });
    });

    it('should look up student identity via provided EntityManager when logging an object payload', async () => {
      // Arrange
      const managerBacklogRepo = {
        create: jest.fn((entry: any) => entry),
        save: jest.fn(async (entry: any) => entry),
      };
      const managerAccountRepo = {
        findOne: jest.fn().mockResolvedValue({ userId: 77 }),
      };
      const managerUserRepo = {
        findOne: jest.fn().mockResolvedValue({ nickname: 'Tomek', name: 'Tomasz', surname: 'Lis' }),
      };
      const mockManager = {
        getRepository: jest.fn((entity) => {
          if (entity === BacklogEntity) return managerBacklogRepo;
          if (entity === AccountEntity) return managerAccountRepo;
          if (entity === UserEntity) return managerUserRepo;
          return null;
        }),
      } as unknown as import('typeorm').EntityManager;

      // Act
      await service.logEvent(5, 15, 'SHOP_PURCHASE', { itemName: 'Zbroja' }, mockManager);

      // Assert
      expect(managerAccountRepo.findOne).toHaveBeenCalledWith({ where: { id: 15 }, select: ['userId'] });
      expect(managerUserRepo.findOne).toHaveBeenCalledWith({
        where: { id: 77 },
        select: ['nickname', 'name', 'surname'],
      });
      const savedPayload = JSON.parse(managerBacklogRepo.create.mock.calls[0][0].value);
      expect(savedPayload).toEqual({
        itemName: 'Zbroja',
        studentNickname: 'Tomek',
        studentName: 'Tomasz',
        studentSurname: 'Lis',
      });
    });

    it('should populate identity when value is null and fail safely when account lookup rejects', async () => {
      // Arrange
      accountRepository.findOne.mockResolvedValueOnce({ userId: 50 });
      userRepository.findOne.mockResolvedValueOnce({ nickname: 'Ola', name: 'Aleksandra', surname: 'Maj' });
      backlogRepository.create.mockImplementation((entry: any) => entry);
      backlogRepository.save.mockImplementation(async (entry: any) => entry);

      // Act
      await service.logEvent(5, 20, 'STUDENT_JOINED', null);

      // Assert
      expect(JSON.parse(backlogRepository.create.mock.calls[0][0].value)).toEqual({
        studentNickname: 'Ola',
        studentName: 'Aleksandra',
        studentSurname: 'Maj',
      });

      // Arrange DB error fallback
      accountRepository.findOne.mockRejectedValueOnce(new Error('DB temporarily unavailable'));

      // Act
      await service.logEvent(5, 21, 'SHOP_PURCHASE', { itemName: 'Mikstura' });

      // Assert
      expect(JSON.parse(backlogRepository.create.mock.calls[1][0].value)).toEqual({
        itemName: 'Mikstura',
      });
    });
  });

  describe('notifyEnrolledStudents', () => {
    it('should return immediately when no students are enrolled', async () => {
      // Arrange
      enrollmentRepository.find.mockResolvedValue([]);

      // Act
      await service.notifyEnrolledStudents(5, 'POST_ADDED', { message: 'Nowy wpis' });

      // Assert
      expect(enrollmentRepository.find).toHaveBeenCalledWith({
        where: { groupId: 5 },
        select: ['studentAccountId'],
      });
      expect(backlogRepository.save).not.toHaveBeenCalled();
    });

    it('should return immediately when enrollments only have null studentAccountIds', async () => {
      // Arrange
      enrollmentRepository.find.mockResolvedValue([
        { studentAccountId: null },
        { studentAccountId: undefined },
      ]);

      // Act
      await service.notifyEnrolledStudents(5, 'STAGE_ADDED', { message: 'Nowy etap' });

      // Assert
      expect(backlogRepository.save).not.toHaveBeenCalled();
    });

    it('should batch insert backlog entries for unique enrolled students', async () => {
      // Arrange
      enrollmentRepository.find.mockResolvedValue([
        { studentAccountId: 101 },
        { studentAccountId: 102 },
        { studentAccountId: 101 }, // duplicate
        { studentAccountId: null },
      ]);
      backlogRepository.create.mockImplementation((entry: any) => entry);
      backlogRepository.save.mockResolvedValue([]);

      // Act
      await service.notifyEnrolledStudents(5, 'POST_ADDED', {
        message: 'Opublikowano nowy wpis: Temat 1',
        postId: 10,
      });

      // Assert
      expect(backlogRepository.create).toHaveBeenCalledTimes(2);
      expect(backlogRepository.save).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            groupId: 5,
            accountId: 101,
            type: 'POST_ADDED',
            isRead: false,
            date: expect.any(Date),
            value: expect.stringContaining('Opublikowano nowy wpis: Temat 1'),
          }),
          expect.objectContaining({
            groupId: 5,
            accountId: 102,
            type: 'POST_ADDED',
            isRead: false,
            date: expect.any(Date),
            value: expect.stringContaining('Opublikowano nowy wpis: Temat 1'),
          }),
        ],
        { chunk: 100 },
      );
    });

    it('should use provided EntityManager repository when manager is passed', async () => {
      // Arrange
      const managerEnrollmentRepo = {
        find: jest.fn().mockResolvedValue([{ studentAccountId: 201 }]),
      };
      const managerBacklogRepo = {
        create: jest.fn((e) => e),
        save: jest.fn().mockResolvedValue([]),
      };
      const mockManager = {
        getRepository: jest.fn((entity) => {
          if (entity === EnrollmentEntity) return managerEnrollmentRepo;
          if (entity === BacklogEntity) return managerBacklogRepo;
          return null;
        }),
      } as unknown as import('typeorm').EntityManager;

      // Act
      await service.notifyEnrolledStudents(7, 'SHOP_STATUS_CHANGED', { isOpen: true }, mockManager);

      // Assert
      expect(managerEnrollmentRepo.find).toHaveBeenCalledWith({
        where: { groupId: 7 },
        select: ['studentAccountId'],
      });
      expect(managerBacklogRepo.save).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            groupId: 7,
            accountId: 201,
            type: 'SHOP_STATUS_CHANGED',
            isRead: false,
          }),
        ],
        { chunk: 100 },
      );
      expect(backlogRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getStudentBacklog', () => {
    it('should return error if unauthorized', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue(null);

      // Act
      const result = await service.getStudentBacklog({} as Request, 1, 50, 0);

      // Assert
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return error if student account not found', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('student');
      userRolesService.findAccountIdForRole.mockResolvedValue(null);

      // Act
      const result = await service.getStudentBacklog({} as Request, 1, 50, 0);

      // Assert
      expect(result).toEqual({ error: 'Forbidden: Student account not found' });
    });

    it('should return error if student is not enrolled', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('student');
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      enrollmentRepository.exist.mockResolvedValue(false);

      // Act
      const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;
      const result = await service.getStudentBacklog({} as Request, publicGroupId, 50, 0);

      // Assert
      expect(result).toEqual({ error: 'Forbidden: You are not enrolled in this group' });
    });

    it('should return backlog items for valid student', async () => {
      // Arrange
      const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;
      const internalGroupId = 5;
      const studentAccountId = 10;
      const mockDate = new Date();

      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('student');
      userRolesService.findAccountIdForRole.mockResolvedValue(studentAccountId);
      enrollmentRepository.exist.mockResolvedValue(true);

      const mockEntries = [
        { id: 1, groupId: internalGroupId, accountId: studentAccountId, type: 'STAGE_ADDED', date: mockDate, value: '{"message":"Nowy etap"}' },
      ];
      backlogRepository.find.mockResolvedValue(mockEntries);

      // Act
      const result = await service.getStudentBacklog({} as Request, publicGroupId, 50, 0);

      // Assert
      expect(backlogRepository.find).toHaveBeenCalledWith({
        where: {
          groupId: internalGroupId,
          type: In([
            'STAGE_ADDED',
            'BADGE_ADDED',
            'RANK_ADDED',
            'SHOP_ITEM_ADDED',
            'LIVES_SYSTEM_CHANGED',
            'SHOP_STATUS_CHANGED',
            'POST_ADDED',
            'RANK_UP',
            'BADGE_EARNED',
            'ACTIVITY_COMPLETED',
            'LIVES_CHANGED',
            'CURRENCY_ADDED',
          ]),
          accountId: studentAccountId,
        },
        order: { date: 'DESC' },
        take: 50,
        skip: 0,
      });
      expect(accountRepository.find).not.toHaveBeenCalled();
      expect(userRepository.find).not.toHaveBeenCalled();
      expect(result).toEqual([
        { id: 1, type: 'STAGE_ADDED', date: mockDate.toISOString(), value: '{"message":"Nowy etap"}', accountId: studentAccountId, isRead: false },
      ]);
    });
  });

  describe('getGroupBacklog', () => {
    it('should return error if unauthorized', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue(null);

      // Act
      const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 1;
      const result = await service.getGroupBacklog({} as Request, publicGroupId, 50, 0);

      // Assert
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return error if user role does not have privileges', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('student');

      // Act
      const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 1;
      const result = await service.getGroupBacklog({} as Request, publicGroupId, 50, 0);

      // Assert
      expect(result).toEqual({ error: 'Forbidden: Requires privileges' });
    });

    it('should return error if lecturer does not own the group', async () => {
      // Arrange
      const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;

      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('lecturer');
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      groupRepository.exist.mockResolvedValue(false);

      // Act
      const result = await service.getGroupBacklog({} as Request, publicGroupId, 50, 0);

      // Assert
      expect(result).toEqual({ error: 'Forbidden: You are not the owner of this group' });
    });

    it('should return group backlog items for valid lecturer', async () => {
      // Arrange
      const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;
      const internalGroupId = 5;
      const mockDate = new Date();

      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('lecturer');
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      groupRepository.exist.mockResolvedValue(true);

      const mockEntries = [
        { id: 1, groupId: internalGroupId, accountId: 10, type: 'SHOP_PURCHASE', date: mockDate, value: 'item_1' },
      ];
      backlogRepository.find.mockResolvedValue(mockEntries);

      // Act
      const result = await service.getGroupBacklog({} as Request, publicGroupId, 50, 0);

      // Assert
      expect(groupRepository.exist).toHaveBeenCalledWith({
        where: { id: internalGroupId, teacherAccountId: 10 },
      });
      expect(result).toEqual([
        { id: 1, type: 'SHOP_PURCHASE', date: mockDate.toISOString(), value: 'item_1', accountId: 10, isRead: false },
      ]);
    });

    it('should batch-enrich historical and new entries with student nickname, name, and surname', async () => {
      // Arrange
      const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;
      const mockDate = new Date();
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('lecturer');
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      groupRepository.exist.mockResolvedValue(true);

      backlogRepository.find.mockResolvedValue([
        {
          id: 1,
          groupId: 5,
          accountId: 101,
          type: 'SHOP_PURCHASE',
          date: mockDate,
          value: JSON.stringify({ itemName: 'Mikstura', studentNickname: 'OldNick' }),
          isRead: false,
        },
        {
          id: 2,
          groupId: 5,
          accountId: 0,
          type: 'STUDENT_JOINED',
          date: mockDate,
          value: JSON.stringify({ message: 'Uczeń dołączył do grupy.', studentAccountId: 102 }),
          isRead: false,
        },
        {
          id: 3,
          groupId: 5,
          accountId: 999,
          type: 'ITEM_USED',
          date: mockDate,
          value: JSON.stringify({ itemName: 'Zwój', studentNickname: 'Usunięty' }),
          isRead: true,
        },
      ]);
      accountRepository.find.mockResolvedValue([
        { id: 101, userId: 201 },
        { id: 102, userId: 202 },
      ]);
      userRepository.find.mockResolvedValue([
        { id: 201, nickname: 'Marek', name: 'Marek', surname: 'Nowak' },
        { id: 202, nickname: 'Ania', name: 'Anna', surname: 'Kowalska' },
      ]);

      // Act
      const result = await service.getGroupBacklog({} as Request, publicGroupId, 50, 0);

      // Assert — exactly one batch lookup per table
      expect(accountRepository.find).toHaveBeenCalledWith({ where: { id: In([101, 102, 999]) }, select: ['id', 'userId'] });
      expect(userRepository.find).toHaveBeenCalledWith({
        where: { id: In([201, 202]) },
        select: ['id', 'nickname', 'name', 'surname'],
      });
      expect(Array.isArray(result)).toBe(true);
      if (Array.isArray(result)) {
        expect(result[0]).toMatchObject({
          id: 1,
          studentNickname: 'Marek',
          studentName: 'Marek',
          studentSurname: 'Nowak',
        });
        expect(JSON.parse(result[0].value ?? '{}')).toMatchObject({
          itemName: 'Mikstura',
          studentNickname: 'Marek',
          studentName: 'Marek',
          studentSurname: 'Nowak',
        });
        expect(result[1]).toMatchObject({
          id: 2,
          studentNickname: 'Ania',
          studentName: 'Anna',
          studentSurname: 'Kowalska',
        });
        expect(result[2]).toMatchObject({
          id: 3,
          studentNickname: 'Usunięty',
        });
      }
    });

    it('should attach top-level identity to non-JSON or null entries and skip lookups when no accountId exists', async () => {
      // Arrange
      const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;
      const mockDate = new Date();
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('lecturer');
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      groupRepository.exist.mockResolvedValue(true);

      backlogRepository.find.mockResolvedValue([
        { id: 1, groupId: 5, accountId: 101, type: 'ITEM_USED', date: mockDate, value: 'item_1', isRead: false },
        { id: 2, groupId: 5, accountId: 101, type: 'STUDENT_JOINED', date: mockDate, value: null, isRead: false },
      ]);
      accountRepository.find.mockResolvedValue([{ id: 101, userId: 201 }]);
      userRepository.find.mockResolvedValue([{ id: 201, nickname: 'Marek', name: 'Marek', surname: 'Nowak' }]);

      // Act
      const withIdentity = await service.getGroupBacklog({} as Request, publicGroupId, 50, 0);

      // Assert
      expect(withIdentity).toEqual([
        {
          id: 1,
          type: 'ITEM_USED',
          date: mockDate.toISOString(),
          value: 'item_1',
          accountId: 101,
          isRead: false,
          studentNickname: 'Marek',
          studentName: 'Marek',
          studentSurname: 'Nowak',
        },
        {
          id: 2,
          type: 'STUDENT_JOINED',
          date: mockDate.toISOString(),
          value: null,
          accountId: 101,
          isRead: false,
          studentNickname: 'Marek',
          studentName: 'Marek',
          studentSurname: 'Nowak',
        },
      ]);

      // Arrange zero accountId without studentAccountId
      accountRepository.find.mockClear();
      backlogRepository.find.mockResolvedValue([
        { id: 3, groupId: 5, accountId: 0, type: 'SHOP_PURCHASE', date: mockDate, value: '{}', isRead: false },
      ]);

      // Act
      const withoutAccountId = await service.getGroupBacklog({} as Request, publicGroupId, 50, 0);

      // Assert
      expect(accountRepository.find).not.toHaveBeenCalled();
      expect(withoutAccountId).toEqual([
        { id: 3, type: 'SHOP_PURCHASE', date: mockDate.toISOString(), value: '{}', accountId: 0, isRead: false },
      ]);
    });
  });

  describe('markAsRead', () => {
    const publicGroupId = GROUP_RESPONSE_GROUP_ID_OFFSET + 5;
    const internalGroupId = 5;
    const backlogId = 42;

    it('should return error if unauthorized', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue(null);

      // Act
      const result = await service.markAsRead({} as Request, publicGroupId, backlogId);

      // Assert
      expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('should return error if no role found', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue(null);

      // Act
      const result = await service.markAsRead({} as Request, publicGroupId, backlogId);

      // Assert
      expect(result).toEqual({ error: 'Forbidden: No role found' });
    });

    it('should allow SUPER to mark any backlog item without ownership check', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('super');
      backlogRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      const result = await service.markAsRead({} as Request, publicGroupId, backlogId);

      // Assert
      expect(userRolesService.findAccountIdForRole).not.toHaveBeenCalled();
      expect(groupRepository.exist).not.toHaveBeenCalled();
      expect(backlogRepository.update).toHaveBeenCalledWith(
        { id: backlogId, groupId: internalGroupId },
        { isRead: true },
      );
      expect(result).toEqual({ updated: true });
    });

    it('should return updated: false for SUPER when no row matched', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('super');
      backlogRepository.update.mockResolvedValue({ affected: 0 });

      // Act
      const result = await service.markAsRead({} as Request, publicGroupId, backlogId);

      // Assert
      expect(result).toEqual({ updated: false });
    });

    it('should allow enrolled student to mark their own item as read', async () => {
      // Arrange
      const studentAccountId = 10;
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('student');
      userRolesService.findAccountIdForRole.mockResolvedValue(studentAccountId);
      enrollmentRepository.exist.mockResolvedValue(true);
      backlogRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      const result = await service.markAsRead({} as Request, publicGroupId, backlogId);

      // Assert
      expect(enrollmentRepository.exist).toHaveBeenCalledWith({
        where: { groupId: internalGroupId, studentAccountId },
      });
      expect(backlogRepository.update).toHaveBeenCalledWith(
        { id: backlogId, groupId: internalGroupId, accountId: studentAccountId },
        { isRead: true },
      );
      expect(result).toEqual({ updated: true });
    });

    it('should return Forbidden for student not enrolled in group', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('student');
      userRolesService.findAccountIdForRole.mockResolvedValue(10);
      enrollmentRepository.exist.mockResolvedValue(false);

      // Act
      const result = await service.markAsRead({} as Request, publicGroupId, backlogId);

      // Assert
      expect(result).toEqual({ error: 'Forbidden: You are not enrolled in this group' });
    });

    it('should allow lecturer who owns the group to mark any item as read', async () => {
      // Arrange
      const lecturerAccountId = 20;
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('lecturer');
      userRolesService.findAccountIdForRole.mockResolvedValue(lecturerAccountId);
      groupRepository.exist.mockResolvedValue(true);
      backlogRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      const result = await service.markAsRead({} as Request, publicGroupId, backlogId);

      // Assert
      expect(groupRepository.exist).toHaveBeenCalledWith({
        where: { id: internalGroupId, teacherAccountId: lecturerAccountId },
      });
      expect(backlogRepository.update).toHaveBeenCalledWith(
        { id: backlogId, groupId: internalGroupId },
        { isRead: true },
      );
      expect(result).toEqual({ updated: true });
    });

    it('should return Forbidden for lecturer who does not own the group', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('lecturer');
      userRolesService.findAccountIdForRole.mockResolvedValue(20);
      groupRepository.exist.mockResolvedValue(false);

      // Act
      const result = await service.markAsRead({} as Request, publicGroupId, backlogId);

      // Assert
      expect(result).toEqual({ error: 'Forbidden: You are not the owner of this group' });
    });

    it('should return Forbidden for unknown role', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue('unknown_role');
      userRolesService.findAccountIdForRole.mockResolvedValue(99);

      // Act
      const result = await service.markAsRead({} as Request, publicGroupId, backlogId);

      // Assert
      expect(result).toEqual({ error: 'Forbidden: Role not authorized' });
    });
  });

  describe('clearBacklog', () => {
    const publicGroupId = 100001;
    const internalGroupId = 1;

    it('should clear student notification types when primary role is student', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue(STUDENT_ROLE_NAME);
      userRolesService.findAccountIdForRole.mockResolvedValue(100);
      enrollmentRepository.exist.mockResolvedValue(true);
      backlogRepository.delete.mockResolvedValue({ affected: 5 });

      // Act
      const result = await service.clearBacklog({} as Request, publicGroupId);

      // Assert
      expect(backlogRepository.delete).toHaveBeenCalled();
      expect(result).toEqual({ deleted: 5 });
    });

    it('should clear lecturer activities excluding ITEM_USED when excludeItemUses is true', async () => {
      // Arrange
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 2 });
      userRolesService.resolvePrimaryRoleForUser.mockResolvedValue(LECTURER_ROLE_NAME);
      userRolesService.findAccountIdForRole.mockResolvedValue(200);
      groupRepository.exist.mockResolvedValue(true);
      backlogRepository.delete.mockResolvedValue({ affected: 3 });

      // Act
      const result = await service.clearBacklog({} as Request, publicGroupId, true);

      // Assert
      expect(backlogRepository.delete).toHaveBeenCalled();
      expect(result).toEqual({ deleted: 3 });
    });
  });
});
