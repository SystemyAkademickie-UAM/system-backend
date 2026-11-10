import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Request } from 'express';

import { MagicLinkService } from '../../auth/magic-link/magic-link.service';
import { ORGANIZATION_LOGIN_METHOD_EMAIL, ORGANIZATION_LOGIN_METHOD_SAML } from '../../constants/organization-constants';
import { ADMINISTRATOR_ROLE_NAME, LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../../constants/role-name-constants';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AdminAccessService } from '../admin-access.service';
import { AdminOrganizationAccountRosterService } from './admin-organization-account-roster.service';
import type { CreateOrganizationAccountDto } from './dto/organization-account.dto';

describe('AdminOrganizationAccountRosterService', () => {
  let service: AdminOrganizationAccountRosterService;
  let adminAccessService: { resolveAccountDeletionActor: jest.Mock };
  let magicLinkService: { requestMagicLink: jest.Mock };
  let organizationRepository: { findOne: jest.Mock };
  let accountRepository: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock; create: jest.Mock; count: jest.Mock };
  let userRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  const req = {} as Request;
  const inputDto: CreateOrganizationAccountDto = {
    email: 'Ada@University.Example',
    name: 'Ada',
    surname: 'Lovelace',
    role: STUDENT_ROLE_NAME,
  };

  beforeEach(async () => {
    adminAccessService = {
      resolveAccountDeletionActor: jest.fn().mockResolvedValue({ userId: 4, isSuperAdmin: true }),
    };
    magicLinkService = { requestMagicLink: jest.fn().mockResolvedValue({ sent: true, message: 'sent' }) };
    organizationRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 11, isActive: true, loginMethod: ORGANIZATION_LOGIN_METHOD_EMAIL }),
    };
    accountRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (row: AccountEntity) => ({ ...row, id: row.id ?? 30 })),
      create: jest.fn((row: Partial<AccountEntity>) => row),
      count: jest.fn().mockResolvedValue(0),
    };
    userRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (row: UserEntity) => ({ ...row, id: row.id ?? 9 })),
      create: jest.fn((row: Partial<UserEntity>) => row),
      createQueryBuilder: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(async (work: (manager: { getRepository: (entity: unknown) => unknown }) => Promise<unknown>) => {
        return work({
          getRepository: (entity: unknown) => {
            if (entity === UserEntity) {
              return userRepository;
            }
            if (entity === AccountEntity) {
              return accountRepository;
            }
            throw new Error('unexpected repository');
          },
        });
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOrganizationAccountRosterService,
        { provide: AdminAccessService, useValue: adminAccessService },
        { provide: MagicLinkService, useValue: magicLinkService },
        { provide: getRepositoryToken(OrganizationEntity), useValue: organizationRepository },
        { provide: getRepositoryToken(AccountEntity), useValue: accountRepository },
        { provide: getRepositoryToken(UserEntity), useValue: userRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(AdminOrganizationAccountRosterService);
  });

  function mockEmailLookup(user: UserEntity | null): void {
    userRepository.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(user),
    });
  }

  it('returns the next account id when another page remains', async () => {
    accountRepository.find.mockResolvedValue([
      { id: 10, userId: 1, organizationId: 11, role: STUDENT_ROLE_NAME },
      { id: 11, userId: 2, organizationId: 11, role: STUDENT_ROLE_NAME },
    ]);
    userRepository.find.mockResolvedValue([
      { id: 1, email: 'a@university.example', name: 'A', surname: 'One', nickname: 'a' },
      { id: 2, email: 'b@university.example', name: 'B', surname: 'Two', nickname: 'b' },
    ]);

    const actual = await service.listOrganizationAccountPage(req, 11, 0, 1);

    expect(actual.nextAfterAccountId).toBe(10);
    expect(actual.items).toEqual([
      {
        accountId: 10,
        userId: 1,
        email: 'a@university.example',
        name: 'A',
        surname: 'One',
        nickname: 'a',
        role: STUDENT_ROLE_NAME,
      },
    ]);
  });

  it('does not return an account from outside the organization', async () => {
    accountRepository.findOne.mockResolvedValue(null);

    await expect(service.getOrganizationAccount(req, 11, 99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a user in the requested organization', async () => {
    mockEmailLookup(null);

    const actual = await service.createOrganizationAccount(req, 11, inputDto);

    expect(actual.email).toBe('ada@university.example');
    expect(actual.role).toBe(STUDENT_ROLE_NAME);
    expect(accountRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 11,
      role: STUDENT_ROLE_NAME,
    }));
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing person and does not overwrite their name', async () => {
    mockEmailLookup({
      id: 9,
      email: 'ada@university.example',
      name: 'Old',
      surname: 'Name',
      nickname: 'old',
    } as UserEntity);
    accountRepository.findOne.mockResolvedValue(null);

    const actual = await service.createOrganizationAccount(req, 11, {
      ...inputDto,
      name: 'New',
      role: LECTURER_ROLE_NAME,
    });

    expect(actual.name).toBe('Old');
    expect(actual.role).toBe(LECTURER_ROLE_NAME);
    expect(userRepository.save).not.toHaveBeenCalled();
    expect(accountRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 9,
      organizationId: 11,
      role: LECTURER_ROLE_NAME,
    }));
  });

  it('rejects an organization administrator assigning the administrator role', async () => {
    adminAccessService.resolveAccountDeletionActor.mockResolvedValue({ userId: 8, isSuperAdmin: false });

    await expect(service.createOrganizationAccount(req, 11, {
      ...inputDto,
      role: ADMINISTRATOR_ROLE_NAME,
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a magic link for an organization that does not use email login', async () => {
    organizationRepository.findOne.mockResolvedValue({
      id: 11,
      isActive: true,
      loginMethod: ORGANIZATION_LOGIN_METHOD_SAML,
    });

    await expect(service.sendOrganizationAccountMagicLink(req, 11, 30)).rejects.toBeInstanceOf(BadRequestException);
    expect(magicLinkService.requestMagicLink).not.toHaveBeenCalled();
  });

  it('sends a magic link only for an account in the email organization', async () => {
    accountRepository.findOne.mockResolvedValue({
      id: 30,
      userId: 9,
      organizationId: 11,
      role: LECTURER_ROLE_NAME,
    });
    userRepository.find.mockResolvedValue([
      { id: 9, email: 'ada@university.example', name: 'Ada', surname: 'Lovelace', nickname: 'ada' },
    ]);

    await expect(service.sendOrganizationAccountMagicLink(req, 11, 30)).resolves.toEqual({
      sent: true,
      message: 'sent',
    });
    expect(magicLinkService.requestMagicLink).toHaveBeenCalledWith('ada@university.example', 11, req);
  });

  it('exports only the accounts of the requested organization', async () => {
    accountRepository.find.mockResolvedValue([
      { id: 10, userId: 1, organizationId: 11, role: STUDENT_ROLE_NAME },
    ]);
    userRepository.find.mockResolvedValue([
      { id: 1, email: 'a@university.example', name: 'A', surname: 'One', nickname: 'a' },
    ]);

    const actual = await service.exportOrganizationAccountsCsv(req, 11);

    expect(actual).toContain('accountId,userId,email,name,surname,nickname,role');
    expect(actual).toContain('a@university.example');
  });

  it('counts a new import row as created', async () => {
    mockEmailLookup(null);

    const actual = await service.importOrganizationAccounts(req, 11, { users: [inputDto] });

    expect(actual).toEqual({ created: 1, updated: 0, skipped: 0, failed: [] });
  });

  it('refuses to edit a person who also belongs to another organization', async () => {
    accountRepository.findOne.mockResolvedValue({
      id: 30,
      userId: 9,
      organizationId: 11,
      role: STUDENT_ROLE_NAME,
    });
    accountRepository.count.mockResolvedValue(1);

    await expect(service.updateOrganizationAccount(req, 11, 30, { name: 'New' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
