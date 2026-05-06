import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserEntity } from '../../database/entities/user.entity';
import type { SamlSessionJwtPayload } from '../saml/saml-auth.service';

/**
 * Maps SAML JWT subjects to persisted `users` rows without baking identity into bearer tokens.
 */
@Injectable()
export class SamlLinkedUserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  /**
   * Finds an existing profile by email (`sub`-unique SAML) or creates a minimally populated row.
   */
  async findOrCreateFromSamlSession(payload: SamlSessionJwtPayload): Promise<number> {
    const emailTrimmed = payload.email?.trim() ?? '';
    if (emailTrimmed.length > 0) {
      const byEmail = await this.userRepository.findOne({
        where: { email: emailTrimmed },
      });
      if (byEmail !== null) {
        if (byEmail.samlNameId === null || byEmail.samlNameId !== payload.sub) {
          await this.userRepository.update({ id: byEmail.id }, { samlNameId: payload.sub });
        }
        return byEmail.id;
      }
    }
    const bySub = await this.userRepository.findOne({
      where: { samlNameId: payload.sub },
    });
    if (bySub !== null) {
      if (emailTrimmed.length > 0 && bySub.email !== emailTrimmed) {
        await this.userRepository.update({ id: bySub.id }, { email: emailTrimmed });
      }
      return bySub.id;
    }
    const createdEntity = this.userRepository.create({
      email: emailTrimmed.length > 0 ? emailTrimmed : null,
      samlNameId: payload.sub,
    });
    const saved = await this.userRepository.save(createdEntity);
    return saved.id;
  }
}
