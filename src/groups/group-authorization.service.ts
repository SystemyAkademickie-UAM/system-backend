import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import { ADMINISTRATOR_ROLE_NAME, LECTURER_ROLE_NAME, SUPER_ROLE_NAME } from '../constants/role-name-constants';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';

/**
 * Ensures lecturer-only group management actions run for the group owner
 * (`education.groups.teacher_account_id`), or administrators / superadmins managing the organization.
 */
@Injectable()
export class GroupAuthorizationService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>) {}

  async assertLecturerOwnsGroup(
    userId: number,
    groupId: number,
    organizationId?: number | null,
  ): Promise<number> {
    const isSuper = await this.userRolesService.userHasRole(userId, SUPER_ROLE_NAME);
    const isAdmin =
      organizationId != null
        ? await this.userRolesService.userHasRoleInOrganization(
            userId,
            organizationId,
            ADMINISTRATOR_ROLE_NAME,
          )
        : await this.userRolesService.userHasRole(userId, ADMINISTRATOR_ROLE_NAME);

    const group = await this.groupRepository.findOne({
      where: { id: groupId },
    });
    if (!group) {
      throw new ForbiddenException('Group not found');
    }

    if (isSuper || isAdmin) {
      return group.teacherAccountId;
    }

    const lecturerAccountId =
      organizationId != null
        ? await this.userRolesService.findAccountIdForRoleInOrganization(
            userId,
            organizationId,
            LECTURER_ROLE_NAME)
        : await this.userRolesService.findAccountIdForRole(userId, LECTURER_ROLE_NAME);
    if (lecturerAccountId === null) {
      throw new ForbiddenException('Not authorized');
    }
    if (group.teacherAccountId !== lecturerAccountId) {
      throw new ForbiddenException('Not authorized to manage this group');
    }
    return lecturerAccountId;
  }

  async assertLecturerOwnsGroupFromRequest(
    req: Request,
    groupId: number,
    queryAuth?: string): Promise<number> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, queryAuth);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    return this.assertLecturerOwnsGroup(subject.userId, groupId, subject.organizationId);
  }

  async isLecturerOwner(
    userId: number,
    groupId: number,
    organizationId?: number | null,
  ): Promise<boolean> {
    const isSuper = await this.userRolesService.userHasRole(userId, SUPER_ROLE_NAME);
    if (isSuper) {
      return true;
    }
    const isAdmin =
      organizationId != null
        ? await this.userRolesService.userHasRoleInOrganization(
            userId,
            organizationId,
            ADMINISTRATOR_ROLE_NAME,
          )
        : await this.userRolesService.userHasRole(userId, ADMINISTRATOR_ROLE_NAME);
    if (isAdmin) {
      return true;
    }

    const lecturerAccountId =
      organizationId != null
        ? await this.userRolesService.findAccountIdForRoleInOrganization(
            userId,
            organizationId,
            LECTURER_ROLE_NAME)
        : await this.userRolesService.findAccountIdForRole(userId, LECTURER_ROLE_NAME);
    if (lecturerAccountId === null) {
      return false;
    }
    return this.groupRepository.exist({
      where: { id: groupId, teacherAccountId: lecturerAccountId },
    });
  }
}
