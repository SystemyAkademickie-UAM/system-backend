import { createHash } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  AUTH_USER_EMAIL_MAX_LENGTH,
  AUTH_USER_NAME_FIELD_MAX_LENGTH,
} from '../../constants/database-entity-constants';
import { UserEntity } from '../../database/entities/user.entity';
import type { SamlSessionPayload } from '../saml/saml.types';

/** Default avatar ID for new users (first avatar). */
const DEFAULT_AVATAR_ID = 1;

/** Student ID for SAML-created users without a numeric student ID. */
const SAML_PLACEHOLDER_STUDENT_ID = 0;

function truncateField(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
}

function syntheticEmailFromSub(sub: string): string {
  const digest = createHash('sha256').update(sub).digest('hex').slice(0, 32);
  const local = `saml.${digest}`;
  const suffix = '@placeholder.invalid';
  const maxLocal = AUTH_USER_EMAIL_MAX_LENGTH - suffix.length;
  return `${local.slice(0, Math.max(1, maxLocal))}${suffix}`;
}

function splitDisplayName(displayName: string | undefined): { name: string; surname: string } {
  const trimmed = displayName?.trim() ?? '';
  if (trimmed === '') {
    return { name: '-', surname: '-' };
  }
  const parts = trimmed.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 1) {
    return { name: truncateField(parts[0], AUTH_USER_NAME_FIELD_MAX_LENGTH), surname: '-' };
  }
  return {
    name: truncateField(parts[0], AUTH_USER_NAME_FIELD_MAX_LENGTH),
    surname: truncateField(parts.slice(1).join(' '), AUTH_USER_NAME_FIELD_MAX_LENGTH),
  };
}

/**
 * Maps SAML JWT subjects to persisted `auth.users` rows without baking identity into bearer tokens.
 * Note: `student_id` is now an integer; SAML-created users get a placeholder until linked to an actual student ID.
 */
@Injectable()
export class SamlLinkedUserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  /**
   * Finds an existing profile by email or creates a row satisfying NOT NULL columns.
   */
  async findOrCreateFromSamlSession(payload: SamlSessionPayload): Promise<number> {
    const rawSub = payload.sub.trim();
    if (rawSub === '') {
      throw new UnauthorizedException({
        error: 'SAML_SESSION_INVALID',
        message: 'SAML subject (`sub`) is required.',
      });
    }
    const emailTrimmed = truncateField(payload.email?.trim() ?? '', AUTH_USER_EMAIL_MAX_LENGTH);
    const emailForRow = emailTrimmed.length > 0 ? emailTrimmed : syntheticEmailFromSub(rawSub);
    const { name, surname } = splitDisplayName(payload.displayName);
    const nicknameBase = emailTrimmed.length > 0 ? emailTrimmed.split('@')[0] : rawSub;
    const nickname = truncateField(nicknameBase, AUTH_USER_NAME_FIELD_MAX_LENGTH);
    if (emailTrimmed.length > 0) {
      const byEmail = await this.userRepository.findOne({
        where: { email: emailTrimmed },
      });
      if (byEmail !== null) {
        await this.userRepository.update(
          { id: byEmail.id },
          {
            name,
            surname,
          },
        );
        return byEmail.id;
      }
    }
    const createdEntity = this.userRepository.create({
      email: emailForRow,
      studentId: SAML_PLACEHOLDER_STUDENT_ID,
      name,
      surname,
      nickname,
      avatarId: DEFAULT_AVATAR_ID,
      language: 'PL',
    });
    const saved = await this.userRepository.save(createdEntity);
    return saved.id;
  }
}
