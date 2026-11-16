import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { BroadcastEntity } from '../database/entities/broadcast.entity';
import { UserBroadcastStatusEntity } from '../database/entities/user-broadcast-status.entity';
import { BroadcastsService } from './broadcasts-service';

describe('BroadcastsService', () => {
  let service: BroadcastsService;
  let broadcastRepo: jest.Mocked<Repository<BroadcastEntity>>;
  let statusRepo: jest.Mocked<Repository<UserBroadcastStatusEntity>>;

  beforeEach(async () => {
    const mockBroadcastRepo = {
      create: jest.fn().mockImplementation((val) => ({ id: 1, ...val, createdAt: new Date() })),
      save: jest.fn().mockImplementation(async (val) => ({ id: 1, ...val, createdAt: new Date() })),
      findOne: jest.fn(),
      delete: jest.fn(),
      findAndCount: jest.fn(),
      exist: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockStatusRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BroadcastsService,
        {
          provide: getRepositoryToken(BroadcastEntity),
          useValue: mockBroadcastRepo,
        },
        {
          provide: getRepositoryToken(UserBroadcastStatusEntity),
          useValue: mockStatusRepo,
        },
      ],
    }).compile();

    service = module.get<BroadcastsService>(BroadcastsService);
    broadcastRepo = module.get(getRepositoryToken(BroadcastEntity));
    statusRepo = module.get(getRepositoryToken(UserBroadcastStatusEntity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBroadcast', () => {
    it('creates a broadcast with defaults', async () => {
      const result = await service.createBroadcast(
        { title: '  Important update  ', content: 'Details here' },
        7,
      );

      expect(broadcastRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Important update',
          content: 'Details here',
          level: 'info',
          targetRole: 'all',
          createdByUserId: 7,
        }),
      );
      expect(result.title).toBe('Important update');
    });

    it('rejects invalid expiresAt date', async () => {
      await expect(
        service.createBroadcast(
          { title: 'T', content: 'C', expiresAt: 'invalid-date' },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBroadcastById', () => {
    it('returns mapped broadcast when found', async () => {
      broadcastRepo.findOne.mockResolvedValue({
        id: 5,
        title: 'Planned maintenance',
        content: 'Window tonight',
        level: 'warning',
        targetRole: 'all',
        expiresAt: new Date('2026-11-20T12:00:00.000Z'),
        createdByUserId: 1,
        createdAt: new Date('2026-11-16T10:00:00.000Z'),
      } as BroadcastEntity);

      const actual = await service.getBroadcastById(5);
      expect(broadcastRepo.findOne).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(actual).toEqual({
        id: 5,
        title: 'Planned maintenance',
        content: 'Window tonight',
        level: 'warning',
        targetRole: 'all',
        expiresAt: '2026-11-20T12:00:00.000Z',
        createdAt: '2026-11-16T10:00:00.000Z',
      });
    });

    it('throws NotFoundException when broadcast does not exist', async () => {
      broadcastRepo.findOne.mockResolvedValue(null);
      await expect(service.getBroadcastById(99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateBroadcast', () => {
    it('throws NotFoundException when broadcast does not exist', async () => {
      broadcastRepo.findOne.mockResolvedValue(null);
      await expect(service.updateBroadcast(99, { title: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates provided fields while preserving existing metadata', async () => {
      const existingEntity = {
        id: 3,
        title: 'Old title',
        content: 'Old body',
        level: 'info',
        targetRole: 'all',
        expiresAt: new Date('2026-11-25T10:00:00.000Z'),
        createdByUserId: 7,
        createdAt: new Date('2026-11-10T09:00:00.000Z'),
      } as BroadcastEntity;
      broadcastRepo.findOne.mockResolvedValue(existingEntity);
      broadcastRepo.save.mockImplementation(async (entity) => entity as BroadcastEntity);

      const actual = await service.updateBroadcast(3, {
        title: '  Updated title  ',
        content: '  Updated content  ',
        level: 'critical',
        targetRole: 'lecturer',
        expiresAt: '2026-12-01T15:30:00.000Z',
      });

      expect(broadcastRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 3,
          title: 'Updated title',
          content: 'Updated content',
          level: 'critical',
          targetRole: 'lecturer',
          createdByUserId: 7,
        }),
      );
      expect(actual).toEqual({
        id: 3,
        title: 'Updated title',
        content: 'Updated content',
        level: 'critical',
        targetRole: 'lecturer',
        expiresAt: '2026-12-01T15:30:00.000Z',
        createdAt: '2026-11-10T09:00:00.000Z',
      });
    });

    it('clears expiresAt when null is provided', async () => {
      const existingEntity = {
        id: 4,
        title: 'Notice',
        content: 'Body',
        level: 'info',
        targetRole: 'student',
        expiresAt: new Date('2026-11-25T10:00:00.000Z'),
        createdByUserId: 1,
        createdAt: new Date('2026-11-10T09:00:00.000Z'),
      } as BroadcastEntity;
      broadcastRepo.findOne.mockResolvedValue(existingEntity);
      broadcastRepo.save.mockImplementation(async (entity) => entity as BroadcastEntity);

      const actual = await service.updateBroadcast(4, { expiresAt: null });
      expect(actual.expiresAt).toBeNull();
    });

    it('rejects invalid expiresAt format on update', async () => {
      broadcastRepo.findOne.mockResolvedValue({
        id: 4,
        title: 'Notice',
        content: 'Body',
        level: 'info',
        targetRole: 'all',
        expiresAt: null,
        createdByUserId: 1,
        createdAt: new Date(),
      } as BroadcastEntity);

      await expect(
        service.updateBroadcast(4, { expiresAt: 'not-a-date' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects whitespace-only title or content on update', async () => {
      broadcastRepo.findOne.mockResolvedValue({
        id: 4,
        title: 'Notice',
        content: 'Body',
        level: 'info',
        targetRole: 'all',
        expiresAt: null,
        createdByUserId: 1,
        createdAt: new Date(),
      } as BroadcastEntity);

      await expect(service.updateBroadcast(4, { title: '   ' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateBroadcast(4, { content: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteBroadcast', () => {
    it('throws NotFoundException when id does not exist', async () => {
      broadcastRepo.delete.mockResolvedValue({ raw: [], affected: 0 });
      await expect(service.deleteBroadcast(99)).rejects.toThrow(NotFoundException);
    });

    it('returns deleted true on success', async () => {
      broadcastRepo.delete.mockResolvedValue({ raw: [], affected: 1 });
      const res = await service.deleteBroadcast(1);
      expect(res).toEqual({ deleted: true });
    });
  });

  describe('listAdminBroadcasts', () => {
    it('applies pagination and returns mapped list', async () => {
      broadcastRepo.findAndCount.mockResolvedValue([
        [
          {
            id: 1,
            title: 'Notice',
            content: 'Body',
            level: 'info',
            targetRole: 'all',
            expiresAt: null,
            createdByUserId: 1,
            createdAt: new Date('2026-10-20T10:00:00Z'),
          } as BroadcastEntity,
        ],
        1,
      ]);

      const res = await service.listAdminBroadcasts(10, 0);
      expect(res.total).toBe(1);
      expect(res.items[0].title).toBe('Notice');
    });
  });

  describe('listActiveForUser', () => {
    it('constructs query builder excluding read broadcasts', async () => {
      const qbMock: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 2,
            title: 'For students',
            content: 'Welcome',
            level: 'info',
            targetRole: 'student',
            expiresAt: null,
            createdAt: new Date(),
          },
        ]),
      };
      broadcastRepo.createQueryBuilder.mockReturnValue(qbMock);

      const items = await service.listActiveForUser(42, ['student']);
      expect(items).toHaveLength(1);
      expect(qbMock.where).toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('throws NotFoundException if broadcast does not exist', async () => {
      broadcastRepo.exist.mockResolvedValue(false);
      await expect(service.markAsRead(42, 999)).rejects.toThrow(NotFoundException);
    });

    it('inserts read receipt into status repository', async () => {
      broadcastRepo.exist.mockResolvedValue(true);
      const qbMock: any = {
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      statusRepo.createQueryBuilder.mockReturnValue(qbMock);

      const res = await service.markAsRead(42, 1);
      expect(res).toEqual({ read: true });
      expect(qbMock.execute).toHaveBeenCalled();
    });
  });
});
