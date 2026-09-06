import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request } from 'express';

import { ShopStudentService } from './shop-student-service';
import { GroupEntity } from '../database/entities/group.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { EarnedItemEntity } from '../database/entities/earned-item.entity';
import { ItemEntity } from '../database/entities/item.entity';
import { ShopListingEntity } from '../database/entities/shop-listing.entity';
import { StudentStatsEntity } from '../database/entities/student-stats.entity';
import { BacklogService } from '../backlog/backlog-service';
import { SessionService } from '../auth/session/session.service';
import { UserRolesService } from '../user-roles/user-roles-service';

describe('ShopStudentService', () => {
  let service: ShopStudentService;
  let sessionService: jest.Mocked<SessionService>;
  let userRolesService: jest.Mocked<UserRolesService>;
  let backlogService: { logEvent: jest.Mock };
  let manager: Record<string, jest.Mock>;

  const mockRequest = {} as Request;

  beforeEach(async () => {
    manager = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };
    backlogService = { logEvent: jest.fn().mockResolvedValue({}) };

    const mockDataSource = {
      transaction: jest.fn(async (cb) => cb(manager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopStudentService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(GroupEntity), useValue: {} },
        { provide: getRepositoryToken(EnrollmentEntity), useValue: {} },
        { provide: getRepositoryToken(EarnedItemEntity), useValue: {} },
        {
          provide: BacklogService,
          useValue: backlogService,
        },
        {
          provide: SessionService,
          useValue: { resolveSubjectFromRequest: jest.fn() },
        },
        {
          provide: UserRolesService,
          useValue: { findAccountIdForRole: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ShopStudentService>(ShopStudentService);
    sessionService = module.get(SessionService);
    userRolesService = module.get(UserRolesService);
  });

  describe('buyItem — extra life', () => {
    beforeEach(() => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue({ userId: 1, sessionId: 1, activeRole: null, organizationId: 1 });
      userRolesService.findAccountIdForRole.mockResolvedValue(100);
    });

    it('should throw BadRequestException when currentLives >= maxLives', async () => {
      manager.findOne.mockImplementation(async (entity) => {
        if (entity === GroupEntity) return { id: 1, shopOpen: true, livesEnabled: true, livesShopEnabled: true, lives: 3, startingLives: 3 };
        if (entity === ItemEntity) return { id: 10, isExtraLife: true, groupId: 1 };
        if (entity === ShopListingEntity) return { id: 20, itemId: 10, basePrice: 50 };
        if (entity === EnrollmentEntity) return { id: 5, groupId: 1, studentAccountId: 100 };
        if (entity === StudentStatsEntity) return { id: 50, currency: 100, lives: 3 };
        return null;
      });

      await expect(service.buyItem(mockRequest, 1, 10)).rejects.toThrow(
        'Osiągnięto maksymalną liczbę żyć. Nie można kupić więcej.',
      );
    });

    it('should increment lives by 1 when currentLives < maxLives', async () => {
      const statsObj = { id: 50, currency: 100, lives: 2 };
      manager.findOne.mockImplementation(async (entity) => {
        if (entity === GroupEntity) return { id: 1, shopOpen: true, livesEnabled: true, livesShopEnabled: true, lives: 3, startingLives: 3 };
        if (entity === ItemEntity) return { id: 10, name: 'Dodatkowe Życie', isExtraLife: true, groupId: 1 };
        if (entity === ShopListingEntity) return { id: 20, itemId: 10, basePrice: 50 };
        if (entity === EnrollmentEntity) return { id: 5, groupId: 1, studentAccountId: 100 };
        if (entity === StudentStatsEntity) return statsObj;
        return null;
      });
      manager.find.mockResolvedValue([]);
      manager.save.mockResolvedValue({});

      const result = await service.buyItem(mockRequest, 1, 10);

      expect(result).toEqual({ success: true, message: 'Item purchased successfully' });
      expect(statsObj.lives).toBe(3);
      expect(statsObj.currency).toBe(50);
    });

    it('should allow extra life purchase when group lives cap is null', async () => {
      const statsObj = { id: 50, currency: 100, lives: 99 };
      manager.findOne.mockImplementation(async (entity) => {
        if (entity === GroupEntity) return { id: 1, shopOpen: true, livesEnabled: true, livesShopEnabled: true, lives: null, startingLives: 3 };
        if (entity === ItemEntity) return { id: 10, name: 'Dodatkowe Życie', isExtraLife: true, groupId: 1 };
        if (entity === ShopListingEntity) return { id: 20, itemId: 10, basePrice: 50 };
        if (entity === EnrollmentEntity) return { id: 5, groupId: 1, studentAccountId: 100 };
        if (entity === StudentStatsEntity) return statsObj;
        return null;
      });
      manager.find.mockResolvedValue([]);
      manager.save.mockResolvedValue({});

      const result = await service.buyItem(mockRequest, 1, 10);

      expect(result).toEqual({ success: true, message: 'Item purchased successfully' });
      expect(statsObj.lives).toBe(100);
    });
  });

  describe('useItem — backlog payload', () => {
    beforeEach(() => {
      sessionService.resolveSubjectFromRequest.mockResolvedValue({
        userId: 1,
        sessionId: 1,
        activeRole: null,
        organizationId: 1,
      });
      userRolesService.findAccountIdForRole.mockResolvedValue(100);
    });

    it('should log item details including price alias and descriptions', async () => {
      manager.findOne.mockImplementation(async (entity) => {
        if (entity === EnrollmentEntity) return { id: 5, groupId: 1, studentAccountId: 100 };
        if (entity === EarnedItemEntity) return { id: 8, enrollmentId: 5, itemId: 10, quantity: 1 };
        if (entity === ItemEntity) {
          return {
            id: 10,
            name: 'Mikstura',
            groupId: 1,
            storyDescription: 'Fabula',
            educationalDescription: 'Dydaktyka',
          };
        }
        if (entity === ShopListingEntity) return { id: 20, itemId: 10, basePrice: 50 };
        return null;
      });
      manager.remove.mockResolvedValue({});

      const result = await service.useItem(mockRequest, 1, 10);

      expect(result).toEqual({ success: true, message: 'Item used successfully' });
      expect(backlogService.logEvent).toHaveBeenCalledWith(
        1,
        100,
        'ITEM_USED',
        {
          message: 'Użyto przedmiotu: Mikstura.',
          itemId: 10,
          itemName: 'Mikstura',
          basePrice: 50,
          price: 50,
          storyDescription: 'Fabula',
          educationalDescription: 'Dydaktyka',
        },
        manager,
      );
    });
  });
});
