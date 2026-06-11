import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { SUPER_ROLE_NAME } from '../constants/role-name-constants';
import { UserRolesService } from '../user-roles/user-roles-service';

/** Shared super-role gate for `/api/admin/*` routes. */
@Injectable()
export class AdminAccessService {
  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
  ) {}

  async assertSuperAdmin(req: Request, queryAuth?: string): Promise<void> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, queryAuth);
    if (subject === null) {
      throw new ForbiddenException('Not authorized');
    }
    const isSuper = await this.userRolesService.userHasRole(subject.userId, SUPER_ROLE_NAME);
    if (!isSuper) {
      throw new ForbiddenException('Not authorized');
    }
  }
}
