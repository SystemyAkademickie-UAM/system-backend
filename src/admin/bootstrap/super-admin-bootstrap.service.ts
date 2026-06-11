import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  SUPERADMIN_BOOTSTRAP_DEFAULT_ORGANIZATION_ID,
  SUPERADMIN_BOOTSTRAP_EMAIL_ENV_KEY,
  SUPERADMIN_BOOTSTRAP_ORGANIZATION_ID_ENV_KEY,
} from '../../constants/super-admin-bootstrap-constants';
import { SUPER_ROLE_NAME } from '../../constants/role-name-constants';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';

/**
 * Grants the first `super` account from env when the database has none yet.
 */
@Injectable()
export class SuperAdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(SuperAdminBootstrapService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureBootstrapSuperAdminIfNeeded();
  }

  /** Called after SAML provisioning when a user row exists or is updated. */
  async tryGrantBootstrapSuperOnLogin(userId: number, emailRaw: string | undefined): Promise<void> {
    const bootstrapEmail = this.readBootstrapEmail();
    if (bootstrapEmail === null) {
      return;
    }
    const email = emailRaw?.trim().toLowerCase() ?? '';
    if (email === '' || email !== bootstrapEmail) {
      return;
    }
    await this.grantSuperRoleIfFirst(userId);
  }

  private async ensureBootstrapSuperAdminIfNeeded(): Promise<void> {
    const hasSuper = await this.hasAnySuperAccount();
    if (hasSuper) {
      return;
    }
    const bootstrapEmail = this.readBootstrapEmail();
    if (bootstrapEmail === null) {
      this.logger.warn(
        `No super admin account in database and ${SUPERADMIN_BOOTSTRAP_EMAIL_ENV_KEY} is unset — ` +
          'admin API will be unavailable until a super row is inserted manually.',
      );
      return;
    }
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: bootstrapEmail })
      .getOne();
    if (user === null) {
      this.logger.warn(
        `Bootstrap super admin pending: no auth.users row for ${bootstrapEmail} — ` +
          'will grant super on first SAML login with that email.',
      );
      return;
    }
    await this.grantSuperRoleIfFirst(user.id);
  }

  private async grantSuperRoleIfFirst(userId: number): Promise<void> {
    const hasSuper = await this.hasAnySuperAccount();
    if (hasSuper) {
      return;
    }
    const organizationId = await this.resolveBootstrapOrganizationId();
    const existing = await this.accountRepository.findOne({
      where: { userId, organizationId, role: SUPER_ROLE_NAME },
    });
    if (existing) {
      return;
    }
    const row = this.accountRepository.create({
      userId,
      organizationId,
      role: SUPER_ROLE_NAME,
    });
    await this.accountRepository.save(row);
    this.logger.log(`Bootstrap super admin granted userId=${userId} organizationId=${organizationId}`);
  }

  private async hasAnySuperAccount(): Promise<boolean> {
    return this.accountRepository.exist({ where: { role: SUPER_ROLE_NAME } });
  }

  private readBootstrapEmail(): string | null {
    const raw = this.configService.get<string>(SUPERADMIN_BOOTSTRAP_EMAIL_ENV_KEY, '').trim().toLowerCase();
    if (raw === '') {
      return null;
    }
    return raw;
  }

  private async resolveBootstrapOrganizationId(): Promise<number> {
    const rawOrgId = this.configService.get<string>(SUPERADMIN_BOOTSTRAP_ORGANIZATION_ID_ENV_KEY, '').trim();
    if (rawOrgId !== '') {
      const parsed = Number.parseInt(rawOrgId, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        const organization = await this.organizationRepository.findOne({ where: { id: parsed } });
        if (organization !== null) {
          return parsed;
        }
        this.logger.warn(
          `${SUPERADMIN_BOOTSTRAP_ORGANIZATION_ID_ENV_KEY}=${parsed} not found — falling back to first active organization`,
        );
      }
    }
    const firstActive = await this.organizationRepository.findOne({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
    if (firstActive !== null) {
      return firstActive.id;
    }
    const firstAny = await this.organizationRepository.findOne({ order: { id: 'ASC' } });
    if (firstAny !== null) {
      return firstAny.id;
    }
    return SUPERADMIN_BOOTSTRAP_DEFAULT_ORGANIZATION_ID;
  }
}
