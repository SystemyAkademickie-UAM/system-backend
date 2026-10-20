import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';

import { SessionService } from '../auth/session/session.service';
import { SUPER_ROLE_NAME } from '../constants/role-name-constants';
import { UserRolesService } from '../user-roles/user-roles-service';
import { AdminMaintenanceController } from './admin-maintenance-controller';
import { MaintenanceModeService } from './maintenance-mode-service';
import { SystemStatusController } from './system-status-controller';

describe('Maintenance Controllers', () => {
  let adminController: AdminMaintenanceController;
  let statusController: SystemStatusController;
  let maintenanceService: jest.Mocked<Partial<MaintenanceModeService>>;
  let sessionService: jest.Mocked<Partial<SessionService>>;
  let userRolesService: jest.Mocked<Partial<UserRolesService>>;

  const mockRequest = {} as Request;

  beforeEach(async () => {
    maintenanceService = {
      getMaintenanceStatus: jest.fn().mockResolvedValue({
        enabled: false,
        message: null,
        estimatedEndAt: null,
        updatedAt: null,
      }),
      updateMaintenanceStatus: jest.fn().mockResolvedValue({
        enabled: true,
        message: 'Break',
        estimatedEndAt: null,
        updatedAt: null,
      }),
    };

    sessionService = {
      resolveSubjectFromRequest: jest.fn().mockResolvedValue({ userId: 1 }),
    };

    userRolesService = {
      userHasRole: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        AdminMaintenanceController,
        SystemStatusController,
      ],
      providers: [
        { provide: MaintenanceModeService, useValue: maintenanceService },
        { provide: SessionService, useValue: sessionService },
        { provide: UserRolesService, useValue: userRolesService },
      ],
    }).compile();

    adminController = module.get(AdminMaintenanceController);
    statusController = module.get(SystemStatusController);
  });

  describe('AdminMaintenanceController', () => {
    it('returns status for superadmin', async () => {
      const res = await adminController.getStatus(mockRequest);
      expect(res.enabled).toBe(false);
      expect(sessionService.resolveSubjectFromRequest).toHaveBeenCalledWith(mockRequest);
      expect(userRolesService.userHasRole).toHaveBeenCalledWith(1, SUPER_ROLE_NAME);
    });

    it('throws UnauthorizedException when not authenticated', async () => {
      (sessionService.resolveSubjectFromRequest as jest.Mock).mockResolvedValue(null);
      await expect(adminController.getStatus(mockRequest)).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when authenticated but not superadmin', async () => {
      (sessionService.resolveSubjectFromRequest as jest.Mock).mockResolvedValue({ userId: 10 });
      (userRolesService.userHasRole as jest.Mock).mockResolvedValue(false);
      await expect(adminController.getStatus(mockRequest)).rejects.toThrow(ForbiddenException);
    });

    it('updates maintenance status when superadmin', async () => {
      const res = await adminController.updateStatus(mockRequest, { isEnabled: true, message: 'Break' });
      expect(maintenanceService.updateMaintenanceStatus).toHaveBeenCalledWith(
        { isEnabled: true, message: 'Break' },
        1,
      );
      expect(res.enabled).toBe(true);
    });
  });

  describe('SystemStatusController', () => {
    it('returns operational status with maintenance info without auth', async () => {
      const res = await statusController.getStatus();
      expect(res.maintenance.enabled).toBe(false);
      expect(res.serverTime).toBeDefined();
    });

    it('returns maintenance probe status without auth', async () => {
      const res = await statusController.getMaintenance();
      expect(res.enabled).toBe(false);
    });
  });
});
