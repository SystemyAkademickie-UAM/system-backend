import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { LECTURER_ROLE_NAME } from '../constants/group-api-constants';
import { AuthTokenEntity } from '../database/entities/auth-token.entity';
import { UserRoleEntity } from '../database/entities/user-role.entity';

export type LecturerSession = { userId: number };

/**
 * Validates API `auth` tokens against `auth_tokens`, browser binding, and lecturer role.
 */
@Injectable()
export class LecturerSessionAuthService {
  constructor(
    @InjectRepository(AuthTokenEntity)
    private readonly authTokenRepository: Repository<AuthTokenEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepository: Repository<UserRoleEntity>,
  ) {}

  /**
   * @returns a session when the token exists, browser id matches, and the user has the lecturer role.
   */
  async tryGetLecturerSession(
    authToken: string,
    browserIdHeader: string | undefined,
  ): Promise<LecturerSession | null> {
    const trimmedHeader = browserIdHeader?.trim() ?? '';
    if (trimmedHeader === '') {
      return null;
    }
    const authRecord = await this.authTokenRepository.findOne({ where: { token: authToken } });
    if (!authRecord) {
      return null;
    }
    if (authRecord.browserUuid !== trimmedHeader) {
      return null;
    }
    const lecturerRoleRow = await this.userRoleRepository.findOne({
      where: { userId: authRecord.userId, role: LECTURER_ROLE_NAME },
    });
    if (!lecturerRoleRow) {
      return null;
    }
    return { userId: authRecord.userId };
  }
}
