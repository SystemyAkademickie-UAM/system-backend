import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { QueryFailedError, Repository } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import { GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';
import {
  ENROLL_RESULT_CODE_INVALID,
  ENROLL_RESULT_DB_ERROR,
  ENROLL_RESULT_GROUP_NOT_FOUND,
  ENROLL_RESULT_NOT_AUTHORIZED,
  GROUP_ENROLL_API_JSON_STATUS_OK,
} from '../constants/group-enroll-api-constants';
import { STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { AccountEntity } from '../database/entities/account.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { StudentStatsEntity } from '../database/entities/student-stats.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { RanksService } from '../gamification/ranks-service';
import { BacklogService } from '../backlog/backlog-service';
import { EnrollGroupBodyDto } from './dto/enroll-group-body.dto';
import { JoinGroupQueryDto } from './dto/join-group-query.dto';
import { EnrollmentCodesService } from './enrollment-codes-service';

/**
 * HTTP response body for enrollment endpoint.
 * - `enrollmentId > 0`: success (real enrollment ID)
 * - `enrollmentId < 0`: error code (see ENROLL_RESULT_* constants)
 * - `groupId`: included on success as proof of enrollment target
 */
export type EnrollGroupResponseBody = {
  statusCode: number;
  enrollmentId: number;
  groupId?: number;
};

/**
 * Core enrollment result for internal use.
 * - `enrollmentId > 0`: success
 * - `enrollmentId < 0`: error code
 */
export type EnrollResult = {
  enrollmentId: number;
  groupId: number;
};

function postgresFkViolation(err: unknown): err is QueryFailedError & {
  readonly driverError: { readonly code?: string; readonly detail?: string };
} {
  return (
    err instanceof QueryFailedError &&
    typeof err.driverError === 'object' &&
    err.driverError !== null &&
    'code' in err.driverError &&
    err.driverError.code === '23503'
  );
}

/**
 * Persists `gamification.enrollments` after invite acceptance (caller validates invite elsewhere).
 */
@Injectable()
export class GroupsEnrollmentService {
  private readonly logger = new Logger(GroupsEnrollmentService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    private readonly ranksService: RanksService,
    private readonly enrollmentCodesService: EnrollmentCodesService,
    private readonly backlogService: BacklogService,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(StudentStatsEntity)
    private readonly studentStatsRepository: Repository<StudentStatsEntity>) {}

  private async groupBelongsToStudentOrganization(
    groupId: number,
    studentAccountId: number,
  ): Promise<boolean> {
    const match = await this.groupRepository
      .createQueryBuilder('group')
      .innerJoin(AccountEntity, 'teacherAccount', 'group.teacher_account_id = teacherAccount.id')
      .innerJoin(AccountEntity, 'studentAccount', 'studentAccount.id = :studentAccountId', {
        studentAccountId,
      })
      .where('group.id = :groupId', { groupId })
      .andWhere('teacherAccount.organization_id = studentAccount.organization_id')
      .getCount();
    return match > 0;
  }

  /**
   * Core enrollment logic - use when you already have studentAccountId and groupId.
   * Returns `enrollmentId > 0` on success, negative error code otherwise.
   * @param studentAccountId - The student's account ID from `auth.accounts`
   * @param groupId - The internal group ID (not public ID with offset)
   */
  async enrollStudentById(studentAccountId: number, groupId: number): Promise<EnrollResult> {
    const groupBelongsToOrg = await this.groupBelongsToStudentOrganization(groupId, studentAccountId);
    if (!groupBelongsToOrg) {
      return { enrollmentId: ENROLL_RESULT_GROUP_NOT_FOUND, groupId };
    }
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      select: ['id', 'startingLives', 'lives'],
    });
    if (!group) {
      return { enrollmentId: ENROLL_RESULT_GROUP_NOT_FOUND, groupId };
    }
    const existing = await this.enrollmentRepository.findOne({
      where: { groupId, studentAccountId },
      select: ['id'],
    });
    if (existing !== null) {
      return { enrollmentId: existing.id, groupId };
    }
    try {
      const entity = this.enrollmentRepository.create({ groupId, studentAccountId });
      const saved = await this.enrollmentRepository.save(entity);

      const initialRankId = await this.ranksService.calculateRankForPoints(groupId, 0);
      const maxLives = group.lives ?? group.startingLives ?? 3;
      const configuredStarting = group.startingLives ?? group.lives ?? 3;
      const stats = this.studentStatsRepository.create({
        enrollmentId: saved.id,
        currency: 0,
        totalEarned: 0,
        rankId: initialRankId,
        lives: Math.min(configuredStarting, maxLives),
      });
      await this.studentStatsRepository.save(stats);

      await this.backlogService.logEvent(groupId, studentAccountId, 'STUDENT_JOINED', {
        message: `Uczeń dołączył do grupy.`,
        accountId: studentAccountId,
      });

      return { enrollmentId: saved.id, groupId };
    } catch (err: unknown) {
      this.logEnrollmentFailure(err);
      return { enrollmentId: ENROLL_RESULT_DB_ERROR, groupId };
    }
  }

  /**
   * HTTP handler: resolves auth from request, then enrolls the student.
   * Use for direct API calls; other backend code should use `enrollStudentById` directly.
   */
  async enrollStudentInGroup(
    req: Request,
    publicGroupId: number,
    body: EnrollGroupBodyDto
  ): Promise<EnrollGroupResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
    if (!subject) {
      return { statusCode: GROUP_ENROLL_API_JSON_STATUS_OK, enrollmentId: ENROLL_RESULT_NOT_AUTHORIZED };
    }
    const studentAccountId =
      subject.organizationId === null
        ? null
        : await this.userRolesService.findAccountIdForRoleInOrganization(
            subject.userId,
            subject.organizationId,
            STUDENT_ROLE_NAME);
    if (studentAccountId === null) {
      return { statusCode: GROUP_ENROLL_API_JSON_STATUS_OK, enrollmentId: ENROLL_RESULT_NOT_AUTHORIZED };
    }
    const groupId =
      publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
        ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
        : publicGroupId;
    const result = await this.enrollStudentById(studentAccountId, groupId);
    const publicGroupIdForResponse = groupId + GROUP_RESPONSE_GROUP_ID_OFFSET;
    if (result.enrollmentId > 0) {
      return {
        statusCode: GROUP_ENROLL_API_JSON_STATUS_OK,
        enrollmentId: result.enrollmentId,
        groupId: publicGroupIdForResponse,
      };
    }
    return { statusCode: GROUP_ENROLL_API_JSON_STATUS_OK, enrollmentId: result.enrollmentId };
  }

  /**
   * HTTP handler: resolves auth and enrolls the student when both groupId and entry code match.
   * Lookup is scoped to the given group — codes cannot be probed across all groups.
   */
  async enrollStudentByCode(
    req: Request,
    publicGroupId: number,
    query: JoinGroupQueryDto
  ): Promise<EnrollGroupResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, undefined);
    if (!subject) {
      return { statusCode: GROUP_ENROLL_API_JSON_STATUS_OK, enrollmentId: ENROLL_RESULT_NOT_AUTHORIZED };
    }
    const studentAccountId =
      subject.organizationId === null
        ? null
        : await this.userRolesService.findAccountIdForRoleInOrganization(
            subject.userId,
            subject.organizationId,
            STUDENT_ROLE_NAME);
    if (studentAccountId === null) {
      return { statusCode: GROUP_ENROLL_API_JSON_STATUS_OK, enrollmentId: ENROLL_RESULT_NOT_AUTHORIZED };
    }
    const internalGroupId =
      publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
        ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
        : publicGroupId;
    const groupExists = await this.groupRepository.exist({ where: { id: internalGroupId } });
    if (!groupExists) {
      return { statusCode: GROUP_ENROLL_API_JSON_STATUS_OK, enrollmentId: ENROLL_RESULT_GROUP_NOT_FOUND };
    }
    const validatedAt = new Date();
    const validation = await this.enrollmentCodesService.validateCodeForGroup(
      internalGroupId,
      query.code,
      validatedAt);
    if (!validation.ok) {
      return { statusCode: GROUP_ENROLL_API_JSON_STATUS_OK, enrollmentId: ENROLL_RESULT_CODE_INVALID };
    }
    const existingEnrollment = await this.enrollmentRepository.findOne({
      where: { groupId: internalGroupId, studentAccountId },
      select: ['id'],
    });
    const isNewEnrollment = existingEnrollment === null;
    if (isNewEnrollment) {
      const incremented = await this.enrollmentCodesService.tryIncrementUseCount(
        validation.code.id,
        validatedAt);
      if (!incremented) {
        return { statusCode: GROUP_ENROLL_API_JSON_STATUS_OK, enrollmentId: ENROLL_RESULT_CODE_INVALID };
      }
    }
    const result = await this.enrollStudentById(studentAccountId, internalGroupId);
    const publicGroupIdForResponse = internalGroupId + GROUP_RESPONSE_GROUP_ID_OFFSET;
    if (result.enrollmentId > 0) {
      return {
        statusCode: GROUP_ENROLL_API_JSON_STATUS_OK,
        enrollmentId: result.enrollmentId,
        groupId: publicGroupIdForResponse,
      };
    }
    return { statusCode: GROUP_ENROLL_API_JSON_STATUS_OK, enrollmentId: result.enrollmentId };
  }

  private logEnrollmentFailure(err: unknown): void {
    if (postgresFkViolation(err)) {
      const detail =
        typeof err.driverError.detail === 'string' ? err.driverError.detail : '(no detail)';
      this.logger.error(`Group enrollment failed (Postgres ${err.driverError.code}): ${detail}`);
      return;
    }
    if (err instanceof Error) {
      this.logger.error(`Group enrollment failed: ${err.message}`, err.stack);
      return;
    }
    this.logger.error(`Group enrollment failed: ${String(err)}`);
  }
}
