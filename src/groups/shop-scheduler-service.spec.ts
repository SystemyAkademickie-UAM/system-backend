import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LessThanOrEqual } from 'typeorm';
import { BacklogService } from '../backlog/backlog-service';
import { GroupEntity } from '../database/entities/group.entity';
import { ShopSchedulerService } from './shop-scheduler-service';

describe('ShopSchedulerService', () => {
  let service: ShopSchedulerService;
  let mockGroupRepository: { find: jest.Mock; update: jest.Mock };
  let mockBacklogService: { notifyEnrolledStudents: jest.Mock };

  beforeEach(async () => {
    mockGroupRepository = {
      find: jest.fn(),
      update: jest.fn(),
    };
    mockBacklogService = {
      notifyEnrolledStudents: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopSchedulerService,
        {
          provide: getRepositoryToken(GroupEntity),
          useValue: mockGroupRepository,
        },
        {
          provide: BacklogService,
          useValue: mockBacklogService,
        },
      ],
    }).compile();

    service = module.get<ShopSchedulerService>(ShopSchedulerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleShopOpenings', () => {
    it('should update shops that are scheduled to open and notify students', async () => {
      mockGroupRepository.find.mockResolvedValue([{ id: 10 }, { id: 20 }]);
      mockGroupRepository.update.mockResolvedValue({ affected: 2 });

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.handleShopOpenings();

      expect(mockGroupRepository.find).toHaveBeenCalledWith({
        where: {
          shopOpen: false,
          shopOpensAt: expect.any(Object),
        },
        select: ['id'],
      });
      expect(mockGroupRepository.update).toHaveBeenCalledWith(
        {
          shopOpen: false,
          shopOpensAt: expect.any(Object),
        },
        {
          shopOpen: true,
          shopOpensAt: null,
        },
      );
      expect(mockBacklogService.notifyEnrolledStudents).toHaveBeenCalledTimes(2);
      expect(mockBacklogService.notifyEnrolledStudents).toHaveBeenCalledWith(
        10,
        'SHOP_STATUS_CHANGED',
        {
          message: 'Sklep grupy został otwarty.',
          shopOpen: true,
        },
      );
      expect(loggerSpy).toHaveBeenCalledWith('Successfully opened 2 shops.');
    });

    it('should not log if no shops were updated', async () => {
      mockGroupRepository.find.mockResolvedValue([]);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.handleShopOpenings();

      expect(mockGroupRepository.update).not.toHaveBeenCalled();
      expect(mockBacklogService.notifyEnrolledStudents).not.toHaveBeenCalled();
      expect(loggerSpy).not.toHaveBeenCalled();
    });

    it('should catch and log errors', async () => {
      const error = new Error('Database connection failed');
      mockGroupRepository.find.mockRejectedValue(error);

      const loggerSpy = jest.spyOn(service['logger'], 'error');

      await service.handleShopOpenings();

      expect(loggerSpy).toHaveBeenCalledWith('Failed to handle shop openings: Database connection failed');
    });
  });
});
