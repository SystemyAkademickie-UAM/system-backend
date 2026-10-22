import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { SessionService } from '../auth/session/session.service';
import { SUPER_ROLE_NAME } from '../constants/role-name-constants';
import { UserRolesService } from '../user-roles/user-roles-service';

/**
 * Access gate enforcing authentication and super-admin authorization for broadcast management.
 */
@Injectable()
export class BroadcastAccessService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService) {}

  /**
   * Resolves the authenticated user id from the request cookie/header.
   * Throws UnauthorizedException when the session is missing or expired.
   */
  async resolveUserId(req: Request): Promise<number> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (subject === null) {
      throw new UnauthorizedException('Unauthorized');
    }
    return subject.userId;
  }

  /**
   * Resolves the user id and verifies the super-administrator role.
   * Throws ForbiddenException when the user does not hold the super role.
   */
  async resolveSuperAdminUserId(req: Request): Promise<number> {
    const userId = await this.resolveUserId(req);
    const isSuperAdmin = await this.userRolesService.userHasRole(userId, SUPER_ROLE_NAME);
    if (!isSuperAdmin) {
      throw new ForbiddenException('Forbidden: Requires super role');
    }
    return userId;
  }
}
