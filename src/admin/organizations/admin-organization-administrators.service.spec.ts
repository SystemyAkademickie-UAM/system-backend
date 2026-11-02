import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';

import { AdminOrganizationAdministratorsService } from './admin-organization-administrators.service';
import { AdminAccessService } from '../admin-access.service';
import { AccountRemovalService } from '../accounts/account-removal.service';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ADMINISTRATOR_ROLE_NAME } from '../../constants/role-name-constants';

describe('AdminOrganizationAdministratorsService', () => {
  let service: AdminOrganizationAdministratorsService;
  let adminAccessService: { assertSuperAdmin: jest.Mock };
  let accountRemovalService: { removeOrganizationAccountRecord: jest.Mock };
  let organizationRepository: { findOne: jest.Mock };
  let accountRepository: { findOne: jest.Mock; createQueryBuilder?: jest.Mock };

  const req = {} as Request;

  beforeEach(async () => {
    adminAccessService = {
      assertSuperAdmin: jest.fn().mockResolvedValue(undefined),
    };
    accountRemovalService = {
      removeOrganizationAccountRecord: jest.fn().mockResolvedValue({
        accountId: 42,
        userId: 7,
        userRemoved: false,
      }),
    };
    organizationRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 1, isActive: true }),
    };
    accountRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 42,
        organizationId: 1,
        role: ADMINISTRATOR_ROLE_NAME,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOrganizationAdministratorsService,
        { provide: AdminAccessService, useValue: adminAccessService },
        { provide: AccountRemovalService, useValue: accountRemovalService },
        { provide: getRepositoryToken(OrganizationEntity), useValue: organizationRepository },
        { provide: getRepositoryToken(AccountEntity), useValue: accountRepository },
        { provide: getRepositoryToken(UserEntity), useValue: { findOne: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminOrganizationAdministratorsService);
  });

  it('revokeAdministrator uses full account removal cascade', async () => {
    await service.revokeAdministrator(req, 1, 42);

    expect(accountRemovalService.removeOrganizationAccountRecord).toHaveBeenCalledWith(1, 42);
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
