import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { QueryFailedError, Repository } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';
import {
  ENROLL_RESULT_DB_ERROR,
  ENROLL_RESULT_GROUP_NOT_FOUND,
  ENROLL_RESULT_NOT_AUTHORIZED,
  GROUP_ENROLL_API_JSON_STATUS_OK,
} from '../constants/group-enroll-api-constants';
import { STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { EnrollGroupBodyDto } from './dto/enroll-group-body.dto';
import { JoinGroupBodyDto } from './dto/join-group-body.dto';

/**
 * HTTP response body for enrollment endpoint.
 * - `enrollmentId > 0`: success (real enrollment ID)
 * - `enrollmentId < 0`: error code (see ENROLL_RESULT_* constants)
 * - `groupId`: included on success as proof of enrollment target
 */
export type EnrollGroupResponseBody = {
  status: number;
  enrollmentId: number;
  groupId?: number;
};

export type InviteGroupResponseBody = {
  status: number;
  code: string;
  group: number;
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
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) { }

  /**
   * Core enrollment logic - use when you already have studentAccountId and groupId.
   * Returns `enrollmentId > 0` on success, negative error code otherwise.
   * @param studentAccountId - The student's account ID from `auth.accounts`
   * @param groupId - The internal group ID (not public ID with offset)
   */
  async enrollStudentById(studentAccountId: number, groupId: number): Promise<EnrollResult> {
    const groupExists = await this.groupRepository.exist({ where: { id: groupId } });
    if (!groupExists) {
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
    body: EnrollGroupBodyDto,
    browserIdHeader: string | undefined,
  ): Promise<EnrollGroupResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      body.auth,
    );
    if (!subject) {
      return { status: GROUP_ENROLL_API_JSON_STATUS_OK, enrollmentId: ENROLL_RESULT_NOT_AUTHORIZED };
    }
    const studentAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, STUDENT_ROLE_NAME);
    if (studentAccountId === null) {
      return { status: GROUP_ENROLL_API_JSON_STATUS_OK, enrollmentId: ENROLL_RESULT_NOT_AUTHORIZED };
    }
    const groupId =
      publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
        ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
        : publicGroupId;
    const result = await this.enrollStudentById(studentAccountId, groupId);
    const publicGroupIdForResponse = groupId + GROUP_RESPONSE_GROUP_ID_OFFSET;
    if (result.enrollmentId > 0) {
      return {
        status: GROUP_ENROLL_API_JSON_STATUS_OK,
        enrollmentId: result.enrollmentId,
        groupId: publicGroupIdForResponse,
      };
    }
    return { status: GROUP_ENROLL_API_JSON_STATUS_OK, enrollmentId: result.enrollmentId };
  }

  /**
   * HTTP handler: resolves auth and enrolls the student using an entry code.
   */
  async enrollStudentByCode(
    req: Request,
    query: JoinGroupBodyDto,
    browserIdHeader: string | undefined,
  ): Promise<InviteGroupResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      query.auth,
    );
    if (!subject) {
      return { status: 200, code: query.code, group: 1 }; // Code expired / Not authorized
    }
    const studentAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, STUDENT_ROLE_NAME);
    if (studentAccountId === null) {
      return { status: 200, code: query.code, group: 1 }; // Not authorized
    }

    const groupObj = await this.groupRepository.findOne({ where: { entryCode: query.code } });
    if (!groupObj) {
      return { status: 200, code: query.code, group: 0 }; // Code not found
    }

    const result = await this.enrollStudentById(studentAccountId, groupObj.id);
    if (result.enrollmentId > 0) {
      return {
        status: 200,
        code: query.code,
        group: groupObj.id + GROUP_RESPONSE_GROUP_ID_OFFSET,
      };
    }
    return { status: 200, code: query.code, group: 0 };
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
