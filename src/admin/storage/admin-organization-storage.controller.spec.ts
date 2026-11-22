import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';

import { AdminOrganizationStorageController } from './admin-organization-storage.controller';
import { AdminOrganizationStorageService } from './admin-organization-storage.service';
import {
  OrganizationDashboardDetailDto,
  OrganizationStorageDetailDto,
} from './dto/admin-organization-storage.dto';

describe('AdminOrganizationStorageController', () => {
  let controller: AdminOrganizationStorageController;
  let service: {
    getOrganizationDashboard: jest.Mock;
    getOrganizationStorage: jest.Mock;
  };

  const req = {} as Request;

  beforeEach(async () => {
    service = {
      getOrganizationDashboard: jest.fn(),
      getOrganizationStorage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOrganizationStorageController],
      providers: [
        {
          provide: AdminOrganizationStorageService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get(AdminOrganizationStorageController);
  });

  it('delegates getDashboard to storageService', async () => {
    const mockDashboard = {
      organization: { id: 1, name: 'Org 1' },
      summary: {},
    } as OrganizationDashboardDetailDto;
    service.getOrganizationDashboard.mockResolvedValue(mockDashboard);

    const result = await controller.getDashboard(req, 1);

    expect(service.getOrganizationDashboard).toHaveBeenCalledWith(req, 1);
    expect(result).toBe(mockDashboard);
  });

  it('delegates getStorage to storageService', async () => {
    const mockStorage = {
      organizationId: 1,
      folderPath: 'storage/drive/1',
      files: [],
    } as unknown as OrganizationStorageDetailDto;
    service.getOrganizationStorage.mockResolvedValue(mockStorage);

    const result = await controller.getStorage(req, 1);

    expect(service.getOrganizationStorage).toHaveBeenCalledWith(req, 1);
    expect(result).toBe(mockStorage);
  });
});
