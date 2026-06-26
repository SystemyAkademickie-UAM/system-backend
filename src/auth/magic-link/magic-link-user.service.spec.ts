import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  MAGIC_LINK_ACCOUNT_NOT_REGISTERED_ERROR,
} from '../../constants/magic-link-constants';
import { PRIVATE_ORGANIZATION_ID } from '../../constants/organization-constants';
import { SUPER_ROLE_NAME } from '../../constants/role-name-constants';
import { AccountEntity } from '../../database/entities/account.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { MagicLinkUserService } from './magic-link-user.service';

describe('MagicLinkUserService', () => {
  let service: MagicLinkUserService;
  let userRepository: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let accountRepository: { exist: jest.Mock; createQueryBuilder: jest.Mock };

  const clientOrgId = 12;

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    accountRepository = {
      exist: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MagicLinkUserService,
        { provide: getRepositoryToken(UserEntity), useValue: userRepository },
        { provide: getRepositoryToken(AccountEntity), useValue: accountRepository },
      ],
    }).compile();

    service = module.get(MagicLinkUserService);
  });

  function mockUserFound(userId: number): void {
    userRepository.findOne.mockResolvedValue({ id: userId, email: 'player@example.com' });
  }

  function mockEmailOrganizationsForUser(organizationIds: number[]): void {
    accountRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(
        organizationIds.map((organizationId) => ({ organizationId })),
      ),
    });
  }

  it('should resolve organization selected in the login form', async () => {
    mockUserFound(7);
    mockEmailOrganizationsForUser([clientOrgId]);
    const target = await service.resolveEmailMagicLinkTargetForOrganization(
      'player@example.com',
      clientOrgId,
      null,
    );
    expect(target).toEqual({ userId: 7, organizationId: clientOrgId });
  });

  it('should reject when selected organization does not match provisioned email tenant', async () => {
    mockUserFound(7);
    mockEmailOrganizationsForUser([clientOrgId]);
    await expect(
      service.resolveEmailMagicLinkTargetForOrganization('player@example.com', 99, null),
    ).rejects.toMatchObject({
      response: { error: MAGIC_LINK_ACCOUNT_NOT_REGISTERED_ERROR },
    });
  });

  it('should resolve organization automatically when user has one email tenant', async () => {
    mockUserFound(7);
    mockEmailOrganizationsForUser([clientOrgId]);
    const target = await service.resolveEmailMagicLinkTarget('player@example.com', null);
    expect(target).toEqual({ userId: 7, organizationId: clientOrgId });
  });

  it('should allow bootstrap super email for internal org 1', async () => {
    mockUserFound(3);
    mockEmailOrganizationsForUser([]);
    const target = await service.resolveEmailMagicLinkTarget(
      'superadmin@localhost.invalid',
      'superadmin@localhost.invalid',
    );
    expect(target).toEqual({ userId: 3, organizationId: PRIVATE_ORGANIZATION_ID });
  });

  it('should allow existing superadmin in private organization', async () => {
    mockUserFound(3);
    mockEmailOrganizationsForUser([]);
    accountRepository.exist.mockResolvedValueOnce(true);
    const target = await service.resolveEmailMagicLinkTarget('superadmin@localhost.invalid', null);
    expect(target).toEqual({ userId: 3, organizationId: PRIVATE_ORGANIZATION_ID });
    expect(accountRepository.exist).toHaveBeenCalledWith({
      where: {
        userId: 3,
        organizationId: PRIVATE_ORGANIZATION_ID,
        role: SUPER_ROLE_NAME,
      },
    });
  });

  it('should reject unknown email', async () => {
    userRepository.findOne.mockResolvedValue(null);
    userRepository.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(undefined),
    });
    await expect(
      service.resolveEmailMagicLinkTarget('unknown@example.com', null),
    ).rejects.toMatchObject({
      response: { error: MAGIC_LINK_ACCOUNT_NOT_REGISTERED_ERROR },
    });
  });

  it('should reject user with no email tenant accounts', async () => {
    mockUserFound(9);
    mockEmailOrganizationsForUser([]);
    accountRepository.exist.mockResolvedValue(false);
    await expect(
      service.resolveEmailMagicLinkTarget('orphan@example.com', null),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should resolve organization when user has multiple roles in one email tenant', async () => {
    mockUserFound(9);
    mockEmailOrganizationsForUser([clientOrgId, clientOrgId]);
    const target = await service.resolveEmailMagicLinkTarget('player@example.com', null);
    expect(target).toEqual({ userId: 9, organizationId: clientOrgId });
  });

  it('should reject user provisioned in multiple email tenants', async () => {
    mockUserFound(9);
    mockEmailOrganizationsForUser([12, 13]);
    await expect(
      service.resolveEmailMagicLinkTarget('player@example.com', null),
    ).rejects.toMatchObject({
      response: { error: MAGIC_LINK_ACCOUNT_NOT_REGISTERED_ERROR },
    });
  });
});
