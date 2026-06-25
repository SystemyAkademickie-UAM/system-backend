import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LessThanOrEqual } from 'typeorm';
import { GroupEntity } from '../database/entities/group.entity';
import { ShopSchedulerService } from './shop-scheduler-service';

describe('ShopSchedulerService', () => {
  let service: ShopSchedulerService;
  let mockGroupRepository: { update: jest.Mock };

  beforeEach(async () => {
    mockGroupRepository = {
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopSchedulerService,
        {
          provide: getRepositoryToken(GroupEntity),
          useValue: mockGroupRepository,
        },
      ],
    }).compile();

    service = module.get<ShopSchedulerService>(ShopSchedulerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleShopOpenings', () => {
    it('should update shops that are scheduled to open', async () => {
      mockGroupRepository.update.mockResolvedValue({ affected: 2 });
      
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      
      await service.handleShopOpenings();

      expect(mockGroupRepository.update).toHaveBeenCalledWith(
        {
          shopOpen: false,
          shopOpensAt: expect.any(Object), // LessThanOrEqual(now)
        },
        {
          shopOpen: true,
          shopOpensAt: null,
        }
      );
      expect(loggerSpy).toHaveBeenCalledWith('Successfully opened 2 shops.');
    });

    it('should not log if no shops were updated', async () => {
      mockGroupRepository.update.mockResolvedValue({ affected: 0 });
      
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      
      await service.handleShopOpenings();

      expect(loggerSpy).not.toHaveBeenCalled();
    });

    it('should catch and log errors', async () => {
      const error = new Error('Database connection failed');
      mockGroupRepository.update.mockRejectedValue(error);
      
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      
      await service.handleShopOpenings();

      expect(loggerSpy).toHaveBeenCalledWith('Failed to handle shop openings: Database connection failed');
    });
  });
});
