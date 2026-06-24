import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';

import { AdminOrganizationAccountsService } from './admin-organization-accounts.service';
import { AdminAccessService } from '../admin-access.service';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import {
  ADMINISTRATOR_ROLE_NAME,
  STUDENT_ROLE_NAME,
  SUPER_ROLE_NAME,
} from '../../constants/role-name-constants';
import { SessionService } from '../../auth/session/session.service';
import { UserRolesService } from '../../user-roles/user-roles-service';

describe('AdminOrganizationAccountsService', () => {
  let service: AdminOrganizationAccountsService;
  let sessionService: { resolveSubjectFromRequest: jest.Mock };
  let userRolesService: { userHasRole: jest.Mock };
  let adminAccessService: { resolveAccountDeletionActor: jest.Mock };
  let organizationRepository: { find: jest.Mock; findOne: jest.Mock };
  let accountRepository: { find: jest.Mock };
  let userRepository: { find: jest.Mock };

  const req = {} as Request;

  beforeEach(async () => {
    sessionService = {
      resolveSubjectFromRequest: jest.fn().mockResolvedValue({ userId: 10, activeRole: null, sessionId: 1 }),
    };
    userRolesService = {
      userHasRole: jest.fn().mockResolvedValue(false),
    };
    adminAccessService = {
      resolveAccountDeletionActor: jest.fn().mockResolvedValue({ userId: 10, isSuperAdmin: false }),
    };
    organizationRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 5, isActive: true }),
    };
    accountRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    userRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOrganizationAccountsService,
        { provide: AdminAccessService, useValue: adminAccessService },
        { provide: SessionService, useValue: sessionService },
        { provide: UserRolesService, useValue: userRolesService },
        { provide: getRepositoryToken(OrganizationEntity), useValue: organizationRepository },
        { provide: getRepositoryToken(AccountEntity), useValue: accountRepository },
        { provide: getRepositoryToken(UserEntity), useValue: userRepository },
      ],
    }).compile();

    service = module.get(AdminOrganizationAccountsService);
  });

  it('lists all active organizations for super administrators', async () => {
    userRolesService.userHasRole.mockResolvedValue(true);
    organizationRepository.find.mockResolvedValue([
      { id: 1, name: 'Org A', isActive: true },
      { id: 2, name: 'Org B', isActive: true },
    ]);

    await expect(service.listManageableOrganizations(req)).resolves.toEqual([
      { id: 1, name: 'Org A' },
      { id: 2, name: 'Org B' },
    ]);
  });

  it('lists only administered organizations for org administrators', async () => {
    accountRepository.find.mockResolvedValue([
      { organizationId: 5, role: ADMINISTRATOR_ROLE_NAME },
    ]);
    organizationRepository.find.mockResolvedValue([
      { id: 5, name: 'Managed Org', isActive: true },
    ]);

    await expect(service.listManageableOrganizations(req)).resolves.toEqual([
      { id: 5, name: 'Managed Org' },
    ]);
  });

  it('rejects unauthenticated callers', async () => {
    sessionService.resolveSubjectFromRequest.mockResolvedValue(null);

    await expect(service.listManageableOrganizations(req)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists organization accounts after access check', async () => {
    accountRepository.find.mockResolvedValue([
      { id: 20, userId: 3, organizationId: 5, role: STUDENT_ROLE_NAME },
    ]);
    userRepository.find.mockResolvedValue([
      {
        id: 3,
        email: 'student@test.local',
        nickname: 'Student',
      },
    ]);

    await expect(service.listOrganizationAccounts(req, 5)).resolves.toEqual([
      {
        accountId: 20,
        userId: 3,
        email: 'student@test.local',
        nickname: 'Student',
        role: STUDENT_ROLE_NAME,
      },
    ]);
    expect(adminAccessService.resolveAccountDeletionActor).toHaveBeenCalledWith(req, 5);
  });

  it('rejects listing accounts for inactive organizations', async () => {
    organizationRepository.findOne.mockResolvedValue({ id: 5, isActive: false });

    await expect(service.listOrganizationAccounts(req, 5)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not expose super role in manageable org list logic branch', async () => {
    userRolesService.userHasRole.mockImplementation(async (_userId, role) => role === SUPER_ROLE_NAME);

    await service.listManageableOrganizations(req);

    expect(userRolesService.userHasRole).toHaveBeenCalledWith(10, SUPER_ROLE_NAME);
  });
});
