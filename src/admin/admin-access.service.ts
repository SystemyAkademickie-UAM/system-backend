import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { SessionService } from '../auth/session/session.service';
import { ADMINISTRATOR_ROLE_NAME, SUPER_ROLE_NAME } from '../constants/role-name-constants';
import { UserRolesService } from '../user-roles/user-roles-service';

export type AccountDeletionActor = {
  userId: number;
  isSuperAdmin: boolean;
};

/** Shared super-role gate for `/api/admin/*` routes. */
@Injectable()
export class AdminAccessService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService) {}

  async assertSuperAdmin(req: Request, queryAuth?: string): Promise<void> {
    const actor = await this.resolveAccountDeletionActor(req, undefined, queryAuth);
    if (!actor.isSuperAdmin) {
      throw new ForbiddenException('Not authorized');
    }
  }

  /**
   * Super administrators may delete accounts in any organization.
   * Organization administrators may delete only within their organization.
   */
  async resolveAccountDeletionActor(
    req: Request,
    organizationId?: number,
    queryAuth?: string): Promise<AccountDeletionActor> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, queryAuth);
    if (subject === null) {
      throw new ForbiddenException('Not authorized');
    }
    const isSuperAdmin = await this.userRolesService.userHasRole(subject.userId, SUPER_ROLE_NAME);
    if (isSuperAdmin) {
      return { userId: subject.userId, isSuperAdmin: true };
    }
    if (organizationId === undefined) {
      throw new ForbiddenException('Not authorized');
    }
    const isOrgAdministrator = await this.userRolesService.userHasRoleInOrganization(
      subject.userId,
      organizationId,
      ADMINISTRATOR_ROLE_NAME,
    );
    if (!isOrgAdministrator) {
      throw new ForbiddenException('Not authorized');
    }
    return { userId: subject.userId, isSuperAdmin: false };
  }
}
