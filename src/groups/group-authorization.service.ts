import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';

/**
 * Ensures lecturer-only group management actions run only for the group owner
 * (`education.groups.teacher_account_id`), not for other lecturers who joined as participants.
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
    const isOwner = await this.groupRepository.exist({
      where: { id: groupId, teacherAccountId: lecturerAccountId },
    });
    if (!isOwner) {
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
