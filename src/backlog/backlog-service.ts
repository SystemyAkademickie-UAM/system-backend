import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In } from 'typeorm';
import type { Request } from 'express';

import { BacklogEntity } from '../database/entities/backlog.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { AccountEntity } from '../database/entities/account.entity';
import { UserEntity } from '../database/entities/user.entity';
import { SessionService } from '../auth/session/session.service';
import { UserRolesService } from '../user-roles/user-roles-service';
import {
  ADMINISTRATOR_ROLE_NAME,
  LECTURER_ROLE_NAME,
  STUDENT_ROLE_NAME,
  SUPER_ROLE_NAME,
} from '../constants/role-name-constants';
import { toInternalGroupId } from '../constants/group-api-constants';
import {
  BacklogEventType,
  BacklogPayload,
  serializeBacklogPayload,
} from './backlog-payload';

export interface BacklogItemResponse {
  id: number;
  type: string;
  date: string;
  value: string | null;
  accountId: number;
  isRead: boolean;
}

export type { BacklogEventType };

const LECTURER_ACTIVITY_TYPES: BacklogEventType[] = [
  'STUDENT_JOINED',
  'SHOP_PURCHASE',
  'ITEM_USED',
];

const STUDENT_NOTIFICATION_TYPES: BacklogEventType[] = [
  'STAGE_ADDED',
  'BADGE_ADDED',
  'RANK_ADDED',
  'SHOP_ITEM_ADDED',
  'LIVES_SYSTEM_CHANGED',
  'SHOP_STATUS_CHANGED',
  'POST_ADDED',
  'RANK_UP',
  'BADGE_EARNED',
  'ACTIVITY_COMPLETED',
  'LIVES_CHANGED',
];

@Injectable()
export class BacklogService {
  constructor(
    @InjectRepository(BacklogEntity)
    private readonly backlogRepository: Repository<BacklogEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService) {}

  async logEvent(
    internalGroupId: number,
    accountId: number,
    type: BacklogEventType,
    value: BacklogPayload | string | null = null,
    manager?: EntityManager): Promise<BacklogEntity> {
    
    let studentNickname: string | undefined;
    try {
      const accountRepo = manager ? manager.getRepository(AccountEntity) : this.accountRepository;
      const userRepo = manager ? manager.getRepository(UserEntity) : this.userRepository;
      const account = await accountRepo.findOne({ where: { id: accountId } });
      if (account) {
        const user = await userRepo.findOne({ where: { id: account.userId } });
        if (user) {
          studentNickname = user.nickname;
        }
      }
    } catch (err) {
      // ignore
    }

    let payloadToLog = value;
    if (studentNickname) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        payloadToLog = { ...value, studentNickname };
      } else if (value === null || value === undefined) {
        payloadToLog = { studentNickname };
      }
    }

    const repo = manager ? manager.getRepository(BacklogEntity) : this.backlogRepository;
    const entry = repo.create({
      groupId: internalGroupId,
      accountId,
      type,
      value: serializeBacklogPayload(payloadToLog),
    });
    return repo.save(entry);
  }

  async notifyEnrolledStudents(
    internalGroupId: number,
    type: BacklogEventType,
    payload: BacklogPayload,
    manager?: EntityManager,
  ): Promise<void> {
    const enrollmentRepo = manager
      ? manager.getRepository(EnrollmentEntity)
      : this.enrollmentRepository;
    const enrollments = await enrollmentRepo.find({
      where: { groupId: internalGroupId },
      select: ['studentAccountId'],
    });

    for (const enrollment of enrollments) {
      if (enrollment.studentAccountId == null) {
        continue;
      }
      await this.logEvent(internalGroupId, enrollment.studentAccountId, type, payload, manager);
    }
  }

  async getStudentBacklog(
    req: Request,
    publicGroupId: number,
    take: number,
    skip: number,
  ): Promise<BacklogItemResponse[] | { error: string }> {
    const access = await this.assertEnrolledStudent(req, publicGroupId);
    if ('error' in access) {
      return access;
    }

    return this.fetchGroupEntries(
      access.internalGroupId,
      take,
      skip,
      STUDENT_NOTIFICATION_TYPES,
      access.studentAccountId,
    );
  }

  async getGroupBacklog(
    req: Request,
    publicGroupId: number,
    take: number,
    skip: number,
  ): Promise<BacklogItemResponse[] | { error: string }> {
    const access = await this.assertLecturerGroupAccess(req, publicGroupId);
    if ('error' in access) {
      return access;
    }

    return this.fetchGroupEntries(access.internalGroupId, take, skip, LECTURER_ACTIVITY_TYPES);
  }

  async getUnreadCount(
    req: Request,
    publicGroupId: number,
  ): Promise<{ count: number } | { error: string }> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      return { error: 'Unauthorized' };
    }

    const primaryRole = await this.userRolesService.resolvePrimaryRoleForUser(subject.userId);
    if (!primaryRole) {
      return { error: 'Forbidden: No role found' };
    }

    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      throw new BadRequestException('Invalid group ID');
    }

    if (primaryRole === STUDENT_ROLE_NAME) {
      const access = await this.assertEnrolledStudent(req, publicGroupId);
      if ('error' in access) {
        return access;
      }

      const count = await this.backlogRepository.count({
        where: {
          groupId: internalGroupId,
          isRead: false,
          type: In(STUDENT_NOTIFICATION_TYPES),
          accountId: access.studentAccountId,
        },
      });

      return { count };
    }

    const access = await this.assertLecturerGroupAccess(req, publicGroupId);
    if ('error' in access) {
      return access;
    }

    const count = await this.backlogRepository.count({
      where: {
        groupId: internalGroupId,
        isRead: false,
        type: In(LECTURER_ACTIVITY_TYPES),
      },
    });

    return { count };
  }

  async getBacklogCount(
    req: Request,
    publicGroupId: number,
  ): Promise<{ count: number } | { error: string }> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      return { error: 'Unauthorized' };
    }

    const primaryRole = await this.userRolesService.resolvePrimaryRoleForUser(subject.userId);
    if (!primaryRole) {
      return { error: 'Forbidden: No role found' };
    }

    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      throw new BadRequestException('Invalid group ID');
    }

    if (primaryRole === STUDENT_ROLE_NAME) {
      const access = await this.assertEnrolledStudent(req, publicGroupId);
      if ('error' in access) {
        return access;
      }

      const count = await this.backlogRepository.count({
        where: this.buildListFilter(
          internalGroupId,
          STUDENT_NOTIFICATION_TYPES,
          access.studentAccountId,
        ),
      });

      return { count };
    }

    const access = await this.assertLecturerGroupAccess(req, publicGroupId);
    if ('error' in access) {
      return access;
    }

    const count = await this.backlogRepository.count({
      where: this.buildListFilter(internalGroupId, LECTURER_ACTIVITY_TYPES),
    });

    return { count };
  }

  async markAllAsRead(
    req: Request,
    publicGroupId: number,
  ): Promise<{ updated: number } | { error: string }> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      return { error: 'Unauthorized' };
    }

    const primaryRole = await this.userRolesService.resolvePrimaryRoleForUser(subject.userId);
    if (!primaryRole) {
      return { error: 'Forbidden: No role found' };
    }

    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      throw new BadRequestException('Invalid group ID');
    }

    if (primaryRole === STUDENT_ROLE_NAME) {
      const access = await this.assertEnrolledStudent(req, publicGroupId);
      if ('error' in access) {
        return access;
      }

      const result = await this.backlogRepository.update(
        {
          ...this.buildListFilter(
            internalGroupId,
            STUDENT_NOTIFICATION_TYPES,
            access.studentAccountId,
          ),
          isRead: false,
        },
        { isRead: true },
      );

      return { updated: result.affected ?? 0 };
    }

    if (
      primaryRole === LECTURER_ROLE_NAME
      || primaryRole === ADMINISTRATOR_ROLE_NAME
      || primaryRole === SUPER_ROLE_NAME
    ) {
      const access = await this.assertLecturerGroupAccess(req, publicGroupId);
      if ('error' in access) {
        return access;
      }

      const result = await this.backlogRepository.update(
        {
          ...this.buildListFilter(internalGroupId, LECTURER_ACTIVITY_TYPES),
          isRead: false,
        },
        { isRead: true },
      );

      return { updated: result.affected ?? 0 };
    }

    return { error: 'Forbidden: Role not authorized' };
  }

  async markAsRead(
    req: Request,
    publicGroupId: number,
    backlogId: number,
  ): Promise<{ updated: boolean } | { error: string }> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) return { error: 'Unauthorized' };

    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      throw new BadRequestException('Invalid group ID');
    }

    const primaryRole = await this.userRolesService.resolvePrimaryRoleForUser(subject.userId);
    if (!primaryRole) return { error: 'Forbidden: No role found' };

    if (primaryRole === SUPER_ROLE_NAME) {
      const result = await this.backlogRepository.update(
        { id: backlogId, groupId: internalGroupId },
        { isRead: true },
      );
      return { updated: result.affected ? result.affected > 0 : false };
    }

    if (primaryRole === STUDENT_ROLE_NAME) {
      const access = await this.assertEnrolledStudent(req, publicGroupId);
      if ('error' in access) {
        return access;
      }

      const result = await this.backlogRepository.update(
        { id: backlogId, groupId: internalGroupId, accountId: access.studentAccountId },
        { isRead: true },
      );
      return { updated: result.affected ? result.affected > 0 : false };
    }

    if (primaryRole === LECTURER_ROLE_NAME || primaryRole === ADMINISTRATOR_ROLE_NAME) {
      const access = await this.assertLecturerGroupAccess(req, publicGroupId);
      if ('error' in access) {
        return access;
      }

      const result = await this.backlogRepository.update(
        { id: backlogId, groupId: internalGroupId },
        { isRead: true },
      );
      return { updated: result.affected ? result.affected > 0 : false };
    }

    return { error: 'Forbidden: Role not authorized' };
  }

  async clearBacklog(
    req: Request,
    publicGroupId: number,
    excludeItemUses?: boolean,
  ): Promise<{ deleted: number } | { error: string }> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      return { error: 'Unauthorized' };
    }

    const primaryRole = await this.userRolesService.resolvePrimaryRoleForUser(subject.userId);
    if (!primaryRole) {
      return { error: 'Forbidden: No role found' };
    }

    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      throw new BadRequestException('Invalid group ID');
    }

    if (primaryRole === STUDENT_ROLE_NAME) {
      const access = await this.assertEnrolledStudent(req, publicGroupId);
      if ('error' in access) {
        return access;
      }

      const result = await this.backlogRepository.delete(
        this.buildListFilter(
          internalGroupId,
          STUDENT_NOTIFICATION_TYPES,
          access.studentAccountId,
        ),
      );

      return { deleted: result.affected ?? 0 };
    }

    if (
      primaryRole === LECTURER_ROLE_NAME ||
      primaryRole === ADMINISTRATOR_ROLE_NAME ||
      primaryRole === SUPER_ROLE_NAME
    ) {
      const access = await this.assertLecturerGroupAccess(req, publicGroupId);
      if ('error' in access) {
        return access;
      }

      const activityTypes = excludeItemUses
        ? LECTURER_ACTIVITY_TYPES.filter((type) => type !== 'ITEM_USED')
        : LECTURER_ACTIVITY_TYPES;

      const result = await this.backlogRepository.delete(
        this.buildListFilter(internalGroupId, activityTypes),
      );

      return { deleted: result.affected ?? 0 };
    }

    return { error: 'Forbidden: Role not authorized' };
  }

  private buildListFilter(
    internalGroupId: number,
    types?: BacklogEventType[],
    accountId?: number,
  ) {
    return {
      groupId: internalGroupId,
      ...(types && types.length > 0 ? { type: In(types) } : {}),
      ...(accountId != null ? { accountId } : {}),
    };
  }

  private async fetchGroupEntries(
    internalGroupId: number,
    take: number,
    skip: number,
    types?: BacklogEventType[],
    accountId?: number,
  ): Promise<BacklogItemResponse[]> {
    const entries = await this.backlogRepository.find({
      where: this.buildListFilter(internalGroupId, types, accountId),
      order: { date: 'DESC' },
      take,
      skip,
    });

    return entries.map((entry) => ({
      id: entry.id,
      type: entry.type ?? 'UNKNOWN',
      date: entry.date?.toISOString() ?? new Date().toISOString(),
      value: entry.value,
      accountId: entry.accountId ?? 0,
      isRead: entry.isRead ?? false,
    }));
  }

  private async assertEnrolledStudent(
    req: Request,
    publicGroupId: number,
  ): Promise<{ internalGroupId: number; studentAccountId: number } | { error: string }> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      return { error: 'Unauthorized' };
    }

    const primaryRole = await this.userRolesService.resolvePrimaryRoleForUser(subject.userId);
    if (primaryRole !== STUDENT_ROLE_NAME) {
      return { error: 'Forbidden: Requires privilege' };
    }

    const studentAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      STUDENT_ROLE_NAME);
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

    return { internalGroupId, studentAccountId };
  }

  private async assertLecturerGroupAccess(
    req: Request,
    publicGroupId: number,
  ): Promise<{ internalGroupId: number } | { error: string }> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      return { error: 'Unauthorized' };
    }

    const primaryRole = await this.userRolesService.resolvePrimaryRoleForUser(subject.userId);
    if (!primaryRole) {
      return { error: 'Forbidden: No role found' };
    }

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
        primaryRole);
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

    return { internalGroupId };
  }
}
