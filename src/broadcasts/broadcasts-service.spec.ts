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
