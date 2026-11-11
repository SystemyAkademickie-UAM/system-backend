import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { SessionService } from '../auth/session/session.service';
import { SUPER_ROLE_NAME } from '../constants/role-name-constants';
import { UserRolesService } from '../user-roles/user-roles-service';

type SuperAdminRequest = Request & {
  superAdminUserId?: number;
};

/**
 * Access gate and NestJS guard enforcing authentication and super-admin authorization
 * for FAQ administration endpoints.
 */
@Injectable()
export class FaqAccessService implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
  ) {}

  /**
   * NestJS guard hook executing before route handlers.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<SuperAdminRequest>();
    req.superAdminUserId = await this.resolveSuperAdminUserId(req);
    return true;
  }

  /**
   * Resolves the authenticated user ID from request session cookies or headers.
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
   * Resolves the user ID and verifies that the user holds the super role.
   * Throws ForbiddenException when the user lacks the super role.
   */
  async resolveSuperAdminUserId(req: Request): Promise<number> {
    const cachedUserId = (req as SuperAdminRequest).superAdminUserId;
    if (typeof cachedUserId === 'number') {
      return cachedUserId;
    }
    const userId = await this.resolveUserId(req);
    const isSuperAdmin = await this.userRolesService.userHasRole(userId, SUPER_ROLE_NAME);
    if (!isSuperAdmin) {
      throw new ForbiddenException('Forbidden: Requires super role');
    }
    return userId;
  }
}

