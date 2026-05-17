import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DRIVE_DEFAULT_ORGANIZATION_ID } from '../../constants/drive-service-constants';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../../constants/role-name-constants';
import {
  SAML_BYPASS_DEV_LECTURER_USER,
  SAML_BYPASS_DEV_STUDENT_USER,
  SAML_BYPASS_SEED_ORGANIZATION_NAME,
} from '../../constants/saml-bypass-constants';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import type { SamlUser } from '../saml/saml.types';
import { SamlLinkedUserService } from './saml-linked-user.service';

function parseBypassOrganizationId(raw: string | undefined): number {
  const trimmed = raw?.trim() ?? '';
  if (trimmed === '') {
    return DRIVE_DEFAULT_ORGANIZATION_ID;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : DRIVE_DEFAULT_ORGANIZATION_ID;
}

/**
 * Non-production helper: seeds `auth.users` and role-specific `auth.accounts` (lecturer / student) for smoke tests without IdP.
 */
@Injectable()
export class SamlBypassService {
  constructor(
    private readonly configService: ConfigService,
    private readonly samlLinkedUserService: SamlLinkedUserService,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
  ) {}

  isBypassAllowed(): boolean {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    const raw = this.configService.get<string>('SAML_BYPASS_ENABLED', '').trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }

  assertBypassAllowed(): void {
    if (!this.isBypassAllowed()) {
      throw new ForbiddenException({
        error: 'SAML_BYPASS_DISABLED',
        message:
          'Dev SAML bypass is off. Set SAML_BYPASS_ENABLED=true and NODE_ENV!=production, then retry.',
      });
    }
  }

  sessionUserForProfile(profile: 'student' | 'lecturer'): SamlUser {
    return profile === 'student' ? SAML_BYPASS_DEV_STUDENT_USER : SAML_BYPASS_DEV_LECTURER_USER;
  }

  /**
   * Ensures DB rows exist for the bypass persona (`auth.accounts` with lecturer or student role).
   */
  async seedDevPersona(profile: 'student' | 'lecturer'): Promise<SamlUser> {
    const sessionUser = this.sessionUserForProfile(profile);
    const userId = await this.samlLinkedUserService.findOrCreateFromSamlSession({
      sub: sessionUser.nameId,
      email: sessionUser.email,
      displayName: sessionUser.displayName,
    });
    if (profile === 'lecturer') {
      await this.ensureLecturerAccount(userId);
    } else {
      await this.ensureStudentAccount(userId);
    }
    return sessionUser;
  }

  /**
   * Resolves `organization_id` for seeded dev `auth.accounts`: env id if present in `auth.organizations`, else first row, else seed row.
   */
  private async resolveOrganizationIdForDevAccount(): Promise<number> {
    const preferred = parseBypassOrganizationId(this.configService.get<string>('SAML_BYPASS_ORGANIZATION_ID'));
    const preferredRow = await this.organizationRepository.findOne({
      where: { id: preferred },
      select: ['id'],
    });
    if (preferredRow !== null) {
      return preferredRow.id;
    }
    const firstRows = await this.organizationRepository.find({
      order: { id: 'ASC' },
      take: 1,
      select: ['id'],
    });
    const firstRow = firstRows[0] ?? null;
    if (firstRow !== null) {
      return firstRow.id;
    }
    const seed = this.organizationRepository.create({ name: SAML_BYPASS_SEED_ORGANIZATION_NAME });
    const saved = await this.organizationRepository.save(seed);
    return saved.id;
  }

  private async ensureLecturerAccount(userId: number): Promise<void> {
    const organizationId = await this.resolveOrganizationIdForDevAccount();
    const existing = await this.accountRepository.findOne({
      where: {
        userId,
        organizationId,
        role: LECTURER_ROLE_NAME,
      },
    });
    if (existing !== null) {
      return;
    }
    const row = this.accountRepository.create({
      userId,
      organizationId,
      role: LECTURER_ROLE_NAME,
    });
    await this.accountRepository.save(row);
  }

  private async ensureStudentAccount(userId: number): Promise<void> {
    const organizationId = await this.resolveOrganizationIdForDevAccount();
    const existing = await this.accountRepository.findOne({
      where: {
        userId,
        organizationId,
        role: STUDENT_ROLE_NAME,
      },
    });
    if (existing !== null) {
      return;
    }
    const row = this.accountRepository.create({
      userId,
      organizationId,
      role: STUDENT_ROLE_NAME,
    });
    await this.accountRepository.save(row);
  }
}
