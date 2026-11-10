import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';

import { SessionService } from '../auth/session/session.service';
import { ADMINISTRATOR_ROLE_NAME, SUPER_ROLE_NAME } from '../constants/role-name-constants';
import { UserRolesService } from '../user-roles/user-roles-service';
import { AdminAccessService } from './admin-access.service';

describe('AdminAccessService', () => {
  let service: AdminAccessService;
  let sessionService: { resolveSubjectFromRequest: jest.Mock };
  let userRolesService: { userHasRole: jest.Mock; userHasRoleInOrganization: jest.Mock };
  const req = {} as Request;

  beforeEach(async () => {
    sessionService = { resolveSubjectFromRequest: jest.fn() };
    userRolesService = {
      userHasRole: jest.fn().mockResolvedValue(false),
      userHasRoleInOrganization: jest.fn().mockResolvedValue(true),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAccessService,
        { provide: SessionService, useValue: sessionService },
        { provide: UserRolesService, useValue: userRolesService },
      ],
    }).compile();
    service = module.get(AdminAccessService);
  });

  it('allows a super administrator to manage another organization', async () => {
    sessionService.resolveSubjectFromRequest.mockResolvedValue({
      userId: 4,
      organizationId: 1,
      activeRole: SUPER_ROLE_NAME,
      sessionId: 1,
    });
    userRolesService.userHasRole.mockResolvedValue(true);

    await expect(service.resolveAccountDeletionActor(req, 11)).resolves.toEqual({
      userId: 4,
      isSuperAdmin: true,
    });
  });

  it('allows an organization administrator only for the session organization', async () => {
    sessionService.resolveSubjectFromRequest.mockResolvedValue({
      userId: 8,
      organizationId: 11,
      activeRole: ADMINISTRATOR_ROLE_NAME,
      sessionId: 2,
    });

    await expect(service.resolveAccountDeletionActor(req, 11)).resolves.toEqual({
      userId: 8,
      isSuperAdmin: false,
    });
    expect(userRolesService.userHasRoleInOrganization).toHaveBeenCalledWith(8, 11, ADMINISTRATOR_ROLE_NAME);
  });

  it('rejects an organization administrator asking for a different organization', async () => {
    sessionService.resolveSubjectFromRequest.mockResolvedValue({
      userId: 8,
      organizationId: 11,
      activeRole: ADMINISTRATOR_ROLE_NAME,
      sessionId: 2,
    });

    await expect(service.resolveAccountDeletionActor(req, 12)).rejects.toBeInstanceOf(ForbiddenException);
    expect(userRolesService.userHasRoleInOrganization).not.toHaveBeenCalled();
  });
});
