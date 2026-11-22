import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';

import { AdminOrganizationAccountRosterService } from '../accounts/admin-organization-account-roster.service';
import { AdminOrganizationAdministratorsService } from './admin-organization-administrators.service';
import { AdminAccessService } from '../admin-access.service';
import { AccountRemovalService } from '../accounts/account-removal.service';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ADMINISTRATOR_ROLE_NAME, STUDENT_ROLE_NAME } from '../../constants/role-name-constants';

describe('AdminOrganizationAdministratorsService', () => {
  let service: AdminOrganizationAdministratorsService;
  let adminAccessService: { assertSuperAdmin: jest.Mock; resolveAccountDeletionActor: jest.Mock };
  let accountRemovalService: { removeOrganizationAccountRecord: jest.Mock };
  let organizationRepository: { findOne: jest.Mock };
  let accountRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder?: jest.Mock;
  };

  const req = {} as Request;

  beforeEach(async () => {
    adminAccessService = {
      assertSuperAdmin: jest.fn().mockResolvedValue(undefined),
      resolveAccountDeletionActor: jest.fn().mockResolvedValue({ userId: 8, isSuperAdmin: true }),
    };
    accountRemovalService = {
      removeOrganizationAccountRecord: jest.fn().mockResolvedValue({
        accountId: 42,
        userId: 7,
        userRemoved: false,
      }),
    };
    organizationRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        isActive: true,
        loginMethod: 'email',
        accountLimit: 100,
      }),
    };
    accountRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 42,
        userId: 9,
        organizationId: 1,
        role: ADMINISTRATOR_ROLE_NAME,
      }),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => ({ id: 50, ...row })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOrganizationAdministratorsService,
        { provide: AdminAccessService, useValue: adminAccessService },
        { provide: AccountRemovalService, useValue: accountRemovalService },
        { provide: getRepositoryToken(OrganizationEntity), useValue: organizationRepository },
        { provide: getRepositoryToken(AccountEntity), useValue: accountRepository },
        { provide: getRepositoryToken(UserEntity), useValue: { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]) } },
        {
          provide: AdminOrganizationAccountRosterService,
          useValue: { createOrganizationAccount: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AdminOrganizationAdministratorsService);
  });

  it('revokeAdministrator uses full account removal cascade', async () => {
    accountRepository.find.mockResolvedValue([
      { id: 42, userId: 9, organizationId: 1, role: ADMINISTRATOR_ROLE_NAME },
      { id: 43, userId: 9, organizationId: 1, role: 'lecturer' },
    ]);

    await service.revokeAdministrator(req, 1, 42);

    expect(accountRemovalService.removeOrganizationAccountRecord).toHaveBeenCalledWith(1, 42, 8);
    expect(accountRepository.save).not.toHaveBeenCalled();
  });

  it('revokeAdministrator creates student role if user had no other roles in organization', async () => {
    accountRepository.find.mockResolvedValue([
      { id: 42, userId: 9, organizationId: 1, role: ADMINISTRATOR_ROLE_NAME },
    ]);

    await service.revokeAdministrator(req, 1, 42);

    expect(accountRepository.create).toHaveBeenCalledWith({
      userId: 9,
      organizationId: 1,
      role: STUDENT_ROLE_NAME,
    });
    expect(accountRepository.save).toHaveBeenCalled();
    expect(accountRemovalService.removeOrganizationAccountRecord).toHaveBeenCalledWith(1, 42, 8);
  });

  it('refuses to revoke the caller own administrator role', async () => {
    accountRepository.findOne.mockResolvedValue({
      id: 42,
      userId: 8,
      organizationId: 1,
      role: ADMINISTRATOR_ROLE_NAME,
    });

    await expect(service.revokeAdministrator(req, 1, 42)).rejects.toBeInstanceOf(ForbiddenException);
    expect(accountRemovalService.removeOrganizationAccountRecord).not.toHaveBeenCalled();
  });

  it('revokeAdministrator rejects missing administrator account', async () => {
    accountRepository.findOne.mockResolvedValue(null);

    await expect(service.revokeAdministrator(req, 1, 99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists administrators of one organization', async () => {
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          accountId: 8,
          userId: 4,
          organizationId: 2,
          organizationName: 'Localhost IdP',
          email: 'administrator@localhost.invalid',
          nickname: 'administrator',
          name: 'University',
          surname: 'Administrator',
        },
      ]),
    };
    accountRepository.createQueryBuilder = jest.fn(() => queryBuilder);

    const actual = await service.listAdministrators(req, 2);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'account.organization_id = :organizationId',
      { organizationId: 2 },
    );
    expect(actual).toEqual([
      {
        accountId: 8,
        userId: 4,
        email: 'administrator@localhost.invalid',
        nickname: 'administrator',
        name: 'University',
        surname: 'Administrator',
      },
    ]);
  });

  it('lists administrators across active organizations', async () => {
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          accountId: 8,
          userId: 4,
          organizationId: 2,
          organizationName: 'Localhost IdP',
          email: 'administrator@localhost.invalid',
          nickname: 'administrator',
          name: 'University',
          surname: 'Administrator',
        },
      ]),
    };
    accountRepository.createQueryBuilder = jest.fn(() => queryBuilder);

    const actual = await service.listAllAdministrators(req);

    expect(adminAccessService.assertSuperAdmin).toHaveBeenCalledWith(req, undefined);
    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      'account.organization_id = :organizationId',
      expect.anything(),
    );
    expect(actual).toEqual([
      {
        accountId: 8,
        userId: 4,
        organizationId: 2,
        organizationName: 'Localhost IdP',
        email: 'administrator@localhost.invalid',
        nickname: 'administrator',
        name: 'University',
        surname: 'Administrator',
      },
    ]);
  });
});
