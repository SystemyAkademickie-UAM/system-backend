import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AccountRemovalService } from './account-removal.service';
import { AdminAccessService } from '../admin-access.service';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import {
  ADMINISTRATOR_ROLE_NAME,
  STUDENT_ROLE_NAME,
  SUPER_ROLE_NAME,
} from '../../constants/role-name-constants';
import { UserRolesService } from '../../user-roles/user-roles-service';
import type { Request } from 'express';

describe('AccountRemovalService', () => {
  let service: AccountRemovalService;
  let adminAccessService: { resolveAccountDeletionActor: jest.Mock };
  let userRolesService: { listRolesForUser: jest.Mock };
  let accountRepository: {
    findOne: jest.Mock;
  };
  let organizationRepository: { findOne: jest.Mock };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    query: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      delete: jest.Mock;
      count: jest.Mock;
      findOne: jest.Mock;
    };
  };
  let dataSource: { createQueryRunner: jest.Mock };

  const req = {} as Request;

  beforeEach(async () => {
    adminAccessService = {
      resolveAccountDeletionActor: jest.fn().mockResolvedValue({ userId: 99, isSuperAdmin: false }),
    };
    userRolesService = {
      listRolesForUser: jest.fn().mockResolvedValue([STUDENT_ROLE_NAME]),
    };
    accountRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 5, userId: 10, organizationId: 12, role: STUDENT_ROLE_NAME }),
    };
    organizationRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 12, isActive: true }),
    };
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return [{ count: '0' }];
        }
        if (sql.includes('gamification.enrollments')) {
          return [];
        }
        return [];
      }),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findOne: jest.fn().mockResolvedValue({ id: 10, email: 'student@test.local' }),
      },
    };
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountRemovalService,
        { provide: AdminAccessService, useValue: adminAccessService },
        { provide: UserRolesService, useValue: userRolesService },
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(OrganizationEntity), useValue: organizationRepository },
        { provide: getRepositoryToken(AccountEntity), useValue: accountRepository },
      ],
    }).compile();

    service = module.get(AccountRemovalService);
  });

  it('allows org administrator to delete a student account', async () => {
    const result = await service.deleteOrganizationAccount(req, 12, 5);
    expect(result).toEqual({ accountId: 5, userId: 10, userRemoved: true });
    expect(queryRunner.manager.delete).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('forbids org administrator from deleting privileged accounts in the same organization', async () => {
    accountRepository.findOne.mockResolvedValue({
      id: 5,
      userId: 10,
      organizationId: 12,
      role: ADMINISTRATOR_ROLE_NAME,
    });
    await expect(service.deleteOrganizationAccount(req, 12, 5)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows org administrator to delete student account when user is administrator elsewhere', async () => {
    userRolesService.listRolesForUser.mockResolvedValue([STUDENT_ROLE_NAME, ADMINISTRATOR_ROLE_NAME]);
    const result = await service.deleteOrganizationAccount(req, 12, 5);
    expect(result.accountId).toBe(5);
  });

  it('forbids deleting super role accounts', async () => {
    adminAccessService.resolveAccountDeletionActor.mockResolvedValue({ userId: 1, isSuperAdmin: true });
    accountRepository.findOne.mockResolvedValue({ id: 5, userId: 10, organizationId: 1, role: SUPER_ROLE_NAME });
    userRolesService.listRolesForUser.mockResolvedValue([SUPER_ROLE_NAME]);
    await expect(service.deleteOrganizationAccount(req, 1, 5)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows super administrator to delete administrator accounts', async () => {
    adminAccessService.resolveAccountDeletionActor.mockResolvedValue({ userId: 1, isSuperAdmin: true });
    accountRepository.findOne.mockResolvedValue({
      id: 5,
      userId: 10,
      organizationId: 12,
      role: ADMINISTRATOR_ROLE_NAME,
    });
    userRolesService.listRolesForUser.mockResolvedValue([ADMINISTRATOR_ROLE_NAME]);
    const result = await service.deleteOrganizationAccount(req, 12, 5);
    expect(result.accountId).toBe(5);
  });

  it('throws when account owns groups', async () => {
    queryRunner.query.mockImplementation(async (sql: string) => {
      if (sql.includes('education.groups')) {
        return [{ count: '2' }];
      }
      return [];
    });
    await expect(service.deleteOrganizationAccount(req, 12, 5)).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when account is missing in organization', async () => {
    accountRepository.findOne.mockResolvedValue(null);
    await expect(service.deleteOrganizationAccount(req, 12, 5)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects deletion for inactive organizations', async () => {
    organizationRepository.findOne.mockResolvedValue({ id: 12, isActive: false });
    await expect(service.deleteOrganizationAccount(req, 12, 5)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removeOrganizationAccountRecord purges and deletes without HTTP auth', async () => {
    const result = await service.removeOrganizationAccountRecord(12, 5, 1);
    expect(result).toEqual({ accountId: 5, userId: 10, userRemoved: true });
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });
});
