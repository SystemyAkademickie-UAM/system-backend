import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Request } from 'express';

import {
  MAINTENANCE_ROLE_SWITCH_BLOCKED_ERROR,
  MAINTENANCE_ROLE_SWITCH_BLOCKED_MESSAGE,
} from '../../constants/maintenance-constants';
import { LoginApiService } from './login-api.service';

describe('LoginApiService role and context switching', () => {
  const req = {} as Request;
  let resolveSubjectFromRequest: jest.Mock;
  let listMemberships: jest.Mock;
  let selectContext: jest.Mock;
  let setActiveRole: jest.Mock;
  let userHasRole: jest.Mock;
  let isMaintenanceActive: jest.Mock;
  let service: LoginApiService;

  beforeEach(() => {
    resolveSubjectFromRequest = jest.fn().mockResolvedValue({
      userId: 7,
      organizationId: 2,
      activeRole: 'lecturer',
    });
    listMemberships = jest.fn().mockResolvedValue([
      { organizationId: 1, name: 'Internal', roles: ['super'] },
      { organizationId: 2, name: 'Localhost IdP', roles: ['lecturer', 'student'] },
    ]);
    selectContext = jest.fn().mockResolvedValue(undefined);
    setActiveRole = jest.fn().mockResolvedValue(undefined);
    userHasRole = jest.fn().mockResolvedValue(false);
    isMaintenanceActive = jest.fn().mockResolvedValue(false);
    service = new LoginApiService(
      {
        resolveSubjectFromRequest,
        extractSessionToken: jest.fn().mockReturnValue('session-token'),
      } as never,
      { setActiveRole } as never,
      {
        listRolesForUser: jest.fn().mockResolvedValue(['lecturer', 'student']),
        userHasRole,
      } as never,
      {
        listMemberships,
        select: selectContext,
        describe: jest.fn().mockResolvedValue({ memberships: [], selectionRequired: false }),
      } as never,
      {
        findOne: jest.fn().mockResolvedValue({
          id: 7,
          email: 'user@example.com',
          name: 'Test',
          surname: 'User',
          nickname: 'Tester',
        }),
      } as never,
      { isMaintenanceActive } as never,
    );
  });

  it('rejects a role held only in another organization', async () => {
    await expect(service.setActiveRole(req, 'super')).rejects.toBeInstanceOf(BadRequestException);
    expect(setActiveRole).not.toHaveBeenCalled();
  });

  it('allows role switching when maintenance mode is inactive', async () => {
    await service.setActiveRole(req, 'student');
    expect(setActiveRole).toHaveBeenCalledWith('session-token', 'student');

    await service.selectLoginContext(req, 2, 'student');
    expect(selectContext).toHaveBeenCalledWith('session-token', 7, 2, 'student');
  });

  it('blocks superadmin from changing role to a non-super role during active maintenance', async () => {
    isMaintenanceActive.mockResolvedValue(true);
    resolveSubjectFromRequest.mockResolvedValue({
      userId: 7,
      organizationId: 1,
      activeRole: 'super',
    });
    listMemberships.mockResolvedValue([
      { organizationId: 1, name: 'Internal', roles: ['super', 'student'] },
    ]);

    await expect(service.setActiveRole(req, 'student')).rejects.toThrow(ConflictException);
    expect(setActiveRole).not.toHaveBeenCalled();

    try {
      await service.selectLoginContext(req, 1, 'student');
      throw new Error('Expected ConflictException');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        statusCode: 409,
        error: MAINTENANCE_ROLE_SWITCH_BLOCKED_ERROR,
        message: MAINTENANCE_ROLE_SWITCH_BLOCKED_MESSAGE,
      });
    }
    expect(selectContext).not.toHaveBeenCalled();
  });

  it('blocks non-superadmin users from switching active role during active maintenance', async () => {
    isMaintenanceActive.mockResolvedValue(true);

    await expect(service.setActiveRole(req, 'student')).rejects.toThrow(ConflictException);
    await expect(service.selectLoginContext(req, 2, 'student')).rejects.toThrow(ConflictException);
    expect(setActiveRole).not.toHaveBeenCalled();
    expect(selectContext).not.toHaveBeenCalled();
  });

  it('blocks a multirole super user from picking a non-super role on initial selection during maintenance, while allowing super', async () => {
    isMaintenanceActive.mockResolvedValue(true);
    userHasRole.mockResolvedValue(true);
    resolveSubjectFromRequest.mockResolvedValue({
      userId: 7,
      organizationId: null,
      activeRole: null,
    });

    await expect(service.selectLoginContext(req, 2, 'lecturer')).rejects.toThrow(ConflictException);
    expect(selectContext).not.toHaveBeenCalled();

    await service.selectLoginContext(req, 1, 'super');
    expect(selectContext).toHaveBeenCalledWith('session-token', 7, 1, 'super');
  });
});
