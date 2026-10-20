import { ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { SessionService } from '../auth/session/session.service';
import { SUPER_ROLE_NAME } from '../constants/role-name-constants';
import { UserRolesService } from '../user-roles/user-roles-service';
import { MaintenanceModeGuard } from './maintenance-mode-guard';
import { MaintenanceModeService } from './maintenance-mode-service';

describe('MaintenanceModeGuard', () => {
  let guard: MaintenanceModeGuard;
  let maintenanceService: jest.Mocked<Partial<MaintenanceModeService>>;
  let sessionService: jest.Mocked<Partial<SessionService>>;
  let userRolesService: jest.Mocked<Partial<UserRolesService>>;

  const createMockContext = (path: string): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({ path, url: path }),
    }),
  } as unknown as ExecutionContext);

  beforeEach(async () => {
    maintenanceService = {
      isMaintenanceActive: jest.fn(),
      getMaintenanceStatus: jest.fn().mockResolvedValue({
        enabled: true,
        message: 'Under maintenance',
        estimatedEndAt: null,
        updatedAt: null,
      }),
    };

    sessionService = {
      resolveSubjectFromRequest: jest.fn(),
    };

    userRolesService = {
      userHasRole: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceModeGuard,
        { provide: MaintenanceModeService, useValue: maintenanceService },
        { provide: SessionService, useValue: sessionService },
        { provide: UserRolesService, useValue: userRolesService },
      ],
    }).compile();

    guard = module.get<MaintenanceModeGuard>(MaintenanceModeGuard);
  });

  it('allows all requests when maintenance is inactive', async () => {
    (maintenanceService.isMaintenanceActive as jest.Mock).mockResolvedValue(false);
    const ctx = createMockContext('/api/groups');
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('allows system probe and auth requests even during active maintenance', async () => {
    (maintenanceService.isMaintenanceActive as jest.Mock).mockResolvedValue(true);

    expect(await guard.canActivate(createMockContext('/api/system/status'))).toBe(true);
    expect(await guard.canActivate(createMockContext('/api/auth/saml/login'))).toBe(true);
    expect(await guard.canActivate(createMockContext('/api/docs'))).toBe(true);
  });

  it('allows authenticated super-admins to bypass maintenance break', async () => {
    (maintenanceService.isMaintenanceActive as jest.Mock).mockResolvedValue(true);
    (sessionService.resolveSubjectFromRequest as jest.Mock).mockResolvedValue({ userId: 1 });
    (userRolesService.userHasRole as jest.Mock).mockResolvedValue(true);

    const ctx = createMockContext('/api/groups');
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(userRolesService.userHasRole).toHaveBeenCalledWith(1, SUPER_ROLE_NAME);
  });

  it('throws 503 ServiceUnavailableException for regular users when maintenance is active', async () => {
    (maintenanceService.isMaintenanceActive as jest.Mock).mockResolvedValue(true);
    (sessionService.resolveSubjectFromRequest as jest.Mock).mockResolvedValue({ userId: 42 });
    (userRolesService.userHasRole as jest.Mock).mockResolvedValue(false);

    const ctx = createMockContext('/api/groups');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws 503 for unauthenticated visitors on protected endpoints when maintenance is active', async () => {
    (maintenanceService.isMaintenanceActive as jest.Mock).mockResolvedValue(true);
    (sessionService.resolveSubjectFromRequest as jest.Mock).mockResolvedValue(null);

    const ctx = createMockContext('/api/groups');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ServiceUnavailableException);
  });
});
