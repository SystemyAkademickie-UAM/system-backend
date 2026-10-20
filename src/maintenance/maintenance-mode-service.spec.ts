import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { MaintenanceModeEntity } from '../database/entities/maintenance-mode.entity';
import { MaintenanceModeService } from './maintenance-mode-service';

describe('MaintenanceModeService', () => {
  let service: MaintenanceModeService;
  let maintenanceRepo: jest.Mocked<Repository<MaintenanceModeEntity>>;

  beforeEach(async () => {
    const mockMaintenanceRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (val) => ({ ...val, updatedAt: new Date() })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceModeService,
        {
          provide: getRepositoryToken(MaintenanceModeEntity),
          useValue: mockMaintenanceRepo,
        },
      ],
    }).compile();

    service = module.get<MaintenanceModeService>(MaintenanceModeService);
    maintenanceRepo = module.get(getRepositoryToken(MaintenanceModeEntity));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMaintenanceStatus', () => {
    it('returns disabled defaults when no record exists', async () => {
      maintenanceRepo.findOne.mockResolvedValue(null);
      const res = await service.getMaintenanceStatus();
      expect(res.enabled).toBe(false);
      expect(res.message).toBeNull();
    });

    it('returns mapped status when record exists', async () => {
      maintenanceRepo.findOne.mockResolvedValue({
        id: 1,
        isEnabled: true,
        message: 'Upgrade in progress',
        estimatedEndAt: new Date('2026-10-20T22:00:00Z'),
        updatedByUserId: 1,
        updatedAt: new Date('2026-10-20T19:00:00Z'),
      } as MaintenanceModeEntity);

      const res = await service.getMaintenanceStatus();
      expect(res.enabled).toBe(true);
      expect(res.message).toBe('Upgrade in progress');
      expect(res.estimatedEndAt).toBe('2026-10-20T22:00:00.000Z');
    });
  });

  describe('updateMaintenanceStatus', () => {
    it('updates singleton row and returns mapped response', async () => {
      const res = await service.updateMaintenanceStatus(
        { isEnabled: true, message: 'System update' },
        7,
      );

      expect(maintenanceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          isEnabled: true,
          message: 'System update',
          updatedByUserId: 7,
        }),
      );
      expect(res.enabled).toBe(true);
      expect(res.message).toBe('System update');
    });

    it('rejects invalid estimatedEndAt date format', async () => {
      await expect(
        service.updateMaintenanceStatus(
          { isEnabled: true, estimatedEndAt: 'not-a-date' },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('isMaintenanceActive', () => {
    it('returns true if enabled', async () => {
      maintenanceRepo.findOne.mockResolvedValue({ isEnabled: true } as MaintenanceModeEntity);
      const active = await service.isMaintenanceActive();
      expect(active).toBe(true);
    });

    it('returns false if disabled', async () => {
      maintenanceRepo.findOne.mockResolvedValue({ isEnabled: false } as MaintenanceModeEntity);
      const active = await service.isMaintenanceActive();
      expect(active).toBe(false);
    });

    it('returns false if row is missing', async () => {
      maintenanceRepo.findOne.mockResolvedValue(null);
      const active = await service.isMaintenanceActive();
      expect(active).toBe(false);
    });
  });
});
