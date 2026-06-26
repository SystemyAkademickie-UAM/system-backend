import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  MAGIC_LINK_ACCOUNT_NOT_REGISTERED_ERROR,
  MAGIC_LINK_ACCOUNT_NOT_REGISTERED_MESSAGE,
} from '../../constants/magic-link-constants';
import {
  ORGANIZATION_LOGIN_METHOD_EMAIL,
  ORGANIZATION_LOGIN_METHOD_SAML,
  PRIVATE_ORGANIZATION_ID,
} from '../../constants/organization-constants';
import { SUPER_ROLE_NAME } from '../../constants/role-name-constants';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';

export type EmailMagicLinkTarget = {
  userId: number;
  organizationId: number;
};

/**
 * Resolves provisioned users and their organization for email magic-link login.
 */
@Injectable()
export class MagicLinkUserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
  ) {}

  /**
   * Resolves user id and organization from email alone.
   * Client users must belong to exactly one active email tenant; MAQ internal uses org 1.
   */
  async resolveEmailMagicLinkTarget(
    emailRaw: string,
    bootstrapEmail: string | null,
  ): Promise<EmailMagicLinkTarget> {
    const normalizedEmail = emailRaw.trim().toLowerCase();
    const userId = await this.findUserIdByEmail(normalizedEmail);
    if (userId === null) {
      this.throwAccountNotRegistered();
    }
    const emailOrganizationIds = await this.listActiveMagicLinkOrganizationIdsForUser(userId);
    if (emailOrganizationIds.length === 1) {
      return { userId, organizationId: emailOrganizationIds[0] };
    }
    if (emailOrganizationIds.length > 1) {
      this.throwAccountNotRegistered();
    }
    if (bootstrapEmail !== null && normalizedEmail === bootstrapEmail) {
      return { userId, organizationId: PRIVATE_ORGANIZATION_ID };
    }
    if (await this.hasSuperAccountInPrivateOrganization(userId)) {
      return { userId, organizationId: PRIVATE_ORGANIZATION_ID };
    }
    this.throwAccountNotRegistered();
  }

  /**
   * Validates that the user is provisioned for magic-link login in the given organization.
   */
  async resolveEmailMagicLinkTargetForOrganization(
    emailRaw: string,
    organizationId: number,
    bootstrapEmail: string | null,
  ): Promise<EmailMagicLinkTarget> {
    const normalizedEmail = emailRaw.trim().toLowerCase();
    const userId = await this.findUserIdByEmail(normalizedEmail);
    if (userId === null) {
      this.throwAccountNotRegistered();
    }

    const emailOrganizationIds = await this.listActiveMagicLinkOrganizationIdsForUser(userId);
    if (emailOrganizationIds.includes(organizationId)) {
      return { userId, organizationId };
    }

    if (organizationId === PRIVATE_ORGANIZATION_ID) {
      if (bootstrapEmail !== null && normalizedEmail === bootstrapEmail) {
        return { userId, organizationId: PRIVATE_ORGANIZATION_ID };
      }
      if (await this.hasSuperAccountInPrivateOrganization(userId)) {
        return { userId, organizationId: PRIVATE_ORGANIZATION_ID };
      }
    }

    this.throwAccountNotRegistered();
  }

  /**
   * Validates that the user is still provisioned for magic-link login in the given organization.
   */
  async resolveEligibleUserIdForMagicLink(
    emailRaw: string,
    organizationId: number,
    bootstrapEmail: string | null,
  ): Promise<number> {
    const target = await this.resolveEmailMagicLinkTargetForOrganization(
      emailRaw,
      organizationId,
      bootstrapEmail,
    );
    return target.userId;
  }

  private async listActiveMagicLinkOrganizationIdsForUser(userId: number): Promise<number[]> {
    const rows = await this.accountRepository
      .createQueryBuilder('account')
      .innerJoin(OrganizationEntity, 'org', 'org.id = account.organization_id')
      .select('account.organization_id', 'organizationId')
      .distinct(true)
      .where('account.user_id = :userId', { userId })
      .andWhere('org.is_active = true')
      .andWhere('org.id <> :privateOrgId', { privateOrgId: PRIVATE_ORGANIZATION_ID })
      .andWhere('org.login_method IN (:...loginMethods)', {
        loginMethods: [ORGANIZATION_LOGIN_METHOD_EMAIL, ORGANIZATION_LOGIN_METHOD_SAML],
      })
      .orderBy('account.organization_id', 'ASC')
      .getRawMany<{ organizationId: number }>();
    const organizationIds = rows.map((row) => row.organizationId);
    return [...new Set(organizationIds)];
  }

  private throwAccountNotRegistered(): never {
    throw new NotFoundException({
      error: MAGIC_LINK_ACCOUNT_NOT_REGISTERED_ERROR,
      message: MAGIC_LINK_ACCOUNT_NOT_REGISTERED_MESSAGE,
    });
  }

  private async hasSuperAccountInPrivateOrganization(userId: number): Promise<boolean> {
    return this.accountRepository.exist({
      where: {
        userId,
        organizationId: PRIVATE_ORGANIZATION_ID,
        role: SUPER_ROLE_NAME,
      },
    });
  }

  private async findUserIdByEmail(normalizedEmail: string): Promise<number | null> {
    const byExact = await this.userRepository.findOne({ where: { email: normalizedEmail } });
    if (byExact !== null) {
      return byExact.id;
    }
    const byCaseInsensitive = await this.userRepository
      .createQueryBuilder('u')
      .select('u.id', 'id')
      .where('LOWER(u.email) = :email', { email: normalizedEmail })
      .getRawOne<{ id: number }>();
    if (byCaseInsensitive === undefined) {
      return null;
    }
    return byCaseInsensitive.id;
  }
}
