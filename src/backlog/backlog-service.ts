import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { BacklogEntity } from '../database/entities/backlog.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { STUDENT_ROLE_NAME, LECTURER_ROLE_NAME, ADMINISTRATOR_ROLE_NAME, SUPER_ROLE_NAME } from '../constants/role-name-constants';
import { GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';

export type BacklogItemResponse = {
  id: number;
  type: string;
  date: string;
  value: string | null;
  accountId: number;
};

@Injectable()
export class BacklogService {
  constructor(
    @InjectRepository(BacklogEntity)
    private readonly backlogRepository: Repository<BacklogEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
  ) {}

  /**
   * Internal method to log events to the backlog.
   * Used by other domains (like Gamification or Shop) to record activity.
   */
  async logEvent(
    internalGroupId: number,
    accountId: number,
    type: string,
    value: string | null = null,
  ): Promise<BacklogEntity> {
    const entry = this.backlogRepository.create({
      groupId: internalGroupId,
      accountId,
      type,
      value,
    });
    return this.backlogRepository.save(entry);
  }

  private getInternalGroupId(publicGroupId: number): number {
    return publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
      ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
      : publicGroupId;
  }

  async getStudentBacklog(
    req: Request,
    publicGroupId: number,
    browserIdHeader: string | undefined,
  ): Promise<BacklogItemResponse[] | { error: string }> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      undefined,
    );
    if (!subject) {
      return { error: 'Unauthorized' };
    }

    const studentAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      STUDENT_ROLE_NAME,
    );
    if (!studentAccountId) {
      return { error: 'Student account not found' };
    }

    const internalGroupId = this.getInternalGroupId(publicGroupId);

    const isEnrolled = await this.enrollmentRepository.exist({
      where: {
        groupId: internalGroupId,
        studentAccountId: studentAccountId,
      },
    });

    if (!isEnrolled) {
      return { error: 'Forbidden: Not enrolled in this group' };
    }

    const entries = await this.backlogRepository.find({
      where: {
        groupId: internalGroupId,
        accountId: studentAccountId,
      },
      order: {
        date: 'DESC',
      },
    });

    return entries.map(entry => ({
      id: entry.id,
      type: entry.type || 'UNKNOWN',
      date: entry.date ? entry.date.toISOString() : new Date().toISOString(),
      value: entry.value,
      accountId: entry.accountId || studentAccountId,
    }));
  }

  async getGroupBacklog(
    req: Request,
    publicGroupId: number,
    browserIdHeader: string | undefined,
  ): Promise<BacklogItemResponse[] | { error: string }> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      undefined,
    );
    if (!subject) {
      return { error: 'Unauthorized' };
    }

    const primaryRole = await this.userRolesService.resolvePrimaryRoleForUser(subject.userId);
    const isLecturer = primaryRole !== null && [LECTURER_ROLE_NAME, ADMINISTRATOR_ROLE_NAME, SUPER_ROLE_NAME].includes(primaryRole);

    if (!isLecturer) {
      return { error: 'Forbidden: Requires lecturer privileges' };
    }

    const internalGroupId = this.getInternalGroupId(publicGroupId);

    if (primaryRole === LECTURER_ROLE_NAME) {
      const lecturerAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, LECTURER_ROLE_NAME);
      if (!lecturerAccountId) {
        return { error: 'Forbidden: Requires lecturer privileges' };
      }
      const isOwner = await this.groupRepository.exist({
        where: { id: internalGroupId, teacherAccountId: lecturerAccountId },
      });
      if (!isOwner) {
        return { error: 'Forbidden: You are not the owner of this group' };
      }
    }

    const entries = await this.backlogRepository.find({
      where: {
        groupId: internalGroupId,
      },
      order: {
        date: 'DESC',
      },
    });

    return entries.map(entry => ({
      id: entry.id,
      type: entry.type || 'UNKNOWN',
      date: entry.date ? entry.date.toISOString() : new Date().toISOString(),
      value: entry.value,
      accountId: entry.accountId || 0,
    }));
  }
}
