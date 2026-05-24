import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DRIVE_DEFAULT_ORGANIZATION_ID } from '../../constants/drive-service-constants';
import {
  isSamlBypassPersonaId,
  resolveLegacyBypassProfile,
  SAML_BYPASS_PERSONAS,
  SAML_BYPASS_SEED_ORGANIZATION_NAME,
  type SamlBypassPersonaDefinition,
  type SamlBypassPersonaId,
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

export type SamlBypassPersonaListItem = {
  id: SamlBypassPersonaId;
  label: string;
  sessionRole: string;
};

/**
 * Non-production helper: seeds `auth.users` and role-specific `auth.accounts` for smoke tests without IdP.
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

  listPersonas(): SamlBypassPersonaListItem[] {
    return Object.values(SAML_BYPASS_PERSONAS).map((persona) => ({
      id: persona.id,
      label: persona.label,
      sessionRole: persona.sessionRole,
    }));
  }

  resolvePersonaId(rawPersona: string): SamlBypassPersonaId {
    const trimmed = rawPersona.trim();
    if (isSamlBypassPersonaId(trimmed)) {
      return trimmed;
    }
    const legacy = resolveLegacyBypassProfile(trimmed);
    if (legacy !== null) {
      return legacy;
    }
    throw new BadRequestException({
      error: 'SAML_BYPASS_UNKNOWN_PERSONA',
      message: `Unknown bypass persona "${trimmed}".`,
    });
  }

  personaDefinition(personaId: SamlBypassPersonaId): SamlBypassPersonaDefinition {
    return SAML_BYPASS_PERSONAS[personaId];
  }

  sessionUserForPersona(personaId: SamlBypassPersonaId): SamlUser {
    return SAML_BYPASS_PERSONAS[personaId].user;
  }

  /** @deprecated Use `seedDevPersona('student1' | …)`. */
  sessionUserForProfile(profile: 'student' | 'lecturer'): SamlUser {
    return this.sessionUserForPersona(this.resolvePersonaId(profile));
  }

  /**
   * Ensures DB rows exist for the bypass persona (`auth.accounts` with the matching role).
   */
  async seedDevPersona(personaId: SamlBypassPersonaId): Promise<SamlUser> {
    const persona = SAML_BYPASS_PERSONAS[personaId];
    const sessionUser = persona.user;
    const userId = await this.samlLinkedUserService.findOrCreateFromSamlSession({
      sub: sessionUser.nameId,
      email: sessionUser.email,
      displayName: sessionUser.displayName,
      role: sessionUser.role,
    });
    await this.ensureAccount(userId, persona.accountRole);
    return sessionUser;
  }

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

  private async ensureAccount(userId: number, accountRole: string): Promise<void> {
    const organizationId = await this.resolveOrganizationIdForDevAccount();
    const existing = await this.accountRepository.findOne({
      where: {
        userId,
        organizationId,
        role: accountRole,
      },
    });
    if (existing !== null) {
      return;
    }
    const row = this.accountRepository.create({
      userId,
      organizationId,
      role: accountRole,
    });
    await this.accountRepository.save(row);
  }
}
