import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import type { Request } from 'express';

import { BacklogEntity } from '../database/entities/backlog.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { UserRolesService } from '../user-roles/user-roles-service';
import {
        ADMINISTRATOR_ROLE_NAME,
        LECTURER_ROLE_NAME,
        STUDENT_ROLE_NAME,
        SUPER_ROLE_NAME,
} from '../constants/role-name-constants';
import { toInternalGroupId } from '../constants/group-api-constants';

export interface BacklogItemResponse {
  id: number;
  type: string;
  date: string;
  value: string | null;
  accountId: number;
}

export type BacklogEventType = 
  | 'SHOP_PURCHASE'
  | 'STAGE_COMPLETED'
  | 'ITEM_USED'
  | 'RANK_UP'
  | 'BADGE_EARNED'
  | 'CURRENCY_ADDED'
  | 'LIVES_CHANGED'
  | 'OTHER';

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
    type: BacklogEventType,
    value: string | null = null,
    manager?: EntityManager,
  ): Promise<BacklogEntity> {
    const repo = manager ? manager.getRepository(BacklogEntity) : this.backlogRepository;
    const entry = repo.create({
      groupId: internalGroupId,
      accountId,
      type,
      value,
    });
    return repo.save(entry);
  }

  async getStudentBacklog(
    req: Request,
    publicGroupId: number,
    browserIdHeader: string | undefined,
    authHeader: string | undefined,
    take: number,
    skip: number,
  ): Promise<BacklogItemResponse[] | { error: string }> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      authHeader,
    );
    if (!subject) {
      return { error: 'Unauthorized' };
    }

    const primaryRole = await this.userRolesService.resolvePrimaryRoleForUser(subject.userId);
    if (primaryRole !== STUDENT_ROLE_NAME) {
      return { error: 'Forbidden: Requires privilege' };
    }

    const studentAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      STUDENT_ROLE_NAME,
    );
    if (studentAccountId === null) {
      return { error: 'Forbidden: Student account not found' };
    }

    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      throw new BadRequestException('Invalid group ID');
    }

    const isEnrolled = await this.enrollmentRepository.exist({
      where: {
        groupId: internalGroupId,
        studentAccountId,
      },
    });
    if (!isEnrolled) {
      return { error: 'Forbidden: You are not enrolled in this group' };
    }

    const entries = await this.backlogRepository.find({
      where: {
        groupId: internalGroupId,
        accountId: studentAccountId,
      },
      order: {
        date: 'DESC',
      },
      take,
      skip,
    });

    return entries.map((entry) => ({
      id: entry.id,
      type: entry.type ?? 'UNKNOWN',
      date: entry.date?.toISOString() ?? new Date().toISOString(),
      value: entry.value,
      accountId: entry.accountId ?? 0,
    }));
  }

  async getGroupBacklog(
    req: Request,
    publicGroupId: number,
    browserIdHeader: string | undefined,
    authHeader: string | undefined,
    take: number,
    skip: number,
  ): Promise<BacklogItemResponse[] | { error: string }> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      authHeader,
    );
    if (!subject) {
      return { error: 'Unauthorized' };
    }

    const primaryRole = await this.userRolesService.resolvePrimaryRoleForUser(subject.userId);
    const hasPrivileges =
      primaryRole === SUPER_ROLE_NAME ||
      primaryRole === ADMINISTRATOR_ROLE_NAME ||
      primaryRole === LECTURER_ROLE_NAME;
    if (!hasPrivileges) {
      return { error: 'Forbidden: Requires privileges' };
    }

    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      throw new BadRequestException('Invalid group ID');
    }

    if (primaryRole === LECTURER_ROLE_NAME || primaryRole === ADMINISTRATOR_ROLE_NAME) {
      const accountId = await this.userRolesService.findAccountIdForRole(
        subject.userId,
        primaryRole,
      );
      if (accountId === null) {
        return { error: 'Forbidden: Requires privileges' };
      }

      const isOwner = await this.groupRepository.exist({
        where: {
          id: internalGroupId,
          teacherAccountId: accountId,
        },
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
      take,
      skip,
    });

    return entries.map((entry) => ({
      id: entry.id,
      type: entry.type ?? 'UNKNOWN',
      date: entry.date?.toISOString() ?? new Date().toISOString(),
      value: entry.value,
      accountId: entry.accountId ?? 0,
    }));
  }
}
