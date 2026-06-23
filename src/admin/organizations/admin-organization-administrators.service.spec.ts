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
  let accountRepository: { findOne: jest.Mock };

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
});
