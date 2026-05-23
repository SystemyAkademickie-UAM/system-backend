import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { QueryFailedError, Repository } from 'typeorm';
import * as crypto from 'crypto';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import {
  GROUP_API_JSON_STATUS_OK,
  GROUP_RESPONSE_GROUP_ID_OFFSET,
  GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID,
  GROUP_RESPONSE_GROUP_NOT_CREATED_ID,
} from '../constants/group-api-constants';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { GroupEntity } from '../database/entities/group.entity';
import { AccountEntity } from '../database/entities/account.entity';
import { UserEntity } from '../database/entities/user.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { CreateGroupBodyDto } from './dto/create-group-body.dto';

export type CreateGroupResponseBody = { statusCode: number; group: number };

function nullableTrimmedString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

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
 * Persists groups for lecturers after session checks.
 * `education.groups.teacher_account_id` is `auth.accounts.id` for the row where `user_id` matches the token user and `role = lecturer`.
 */
@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) { }

  async createGroup(
    req: Request,
    body: CreateGroupBodyDto,
    browserIdHeader: string | undefined,
  ): Promise<CreateGroupResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      body.auth,
    );
    if (!subject) {
      return { statusCode: GROUP_API_JSON_STATUS_OK, group: GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID };
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, LECTURER_ROLE_NAME);
    if (lecturerAccountId === null) {
      return { statusCode: GROUP_API_JSON_STATUS_OK, group: GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID };
    }
    try {
      const groupPayload = body.group;
      const nameTrimmed = String(groupPayload.name ?? '').trim();
      if (nameTrimmed === '') {
        return { statusCode: GROUP_API_JSON_STATUS_OK, group: GROUP_RESPONSE_GROUP_NOT_CREATED_ID };
      }
      const entity = this.groupRepository.create({
        teacherAccountId: lecturerAccountId,
        name: nameTrimmed,
        description: nullableTrimmedString(groupPayload.description),
        currency: nullableTrimmedString(groupPayload.currency),
        currencyIcon: nullableTrimmedString(groupPayload.currencyIcon),
        lives: groupPayload.lives ?? null,
        livesIcon: nullableTrimmedString(groupPayload.livesIcon),
        imageRef: nullableTrimmedString(groupPayload.imageRef),
        entryCode: nullableTrimmedString(groupPayload.entryCode),
      });
      const saved = await this.groupRepository.save(entity);
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        group: saved.id + GROUP_RESPONSE_GROUP_ID_OFFSET,
      };
    } catch (err: unknown) {
      this.logGroupCreationFailure(err);
      return { statusCode: GROUP_API_JSON_STATUS_OK, group: GROUP_RESPONSE_GROUP_NOT_CREATED_ID };
    }
  }

  private logGroupCreationFailure(err: unknown): void {
    if (postgresFkViolation(err)) {
      const detail =
        typeof err.driverError.detail === 'string' ? err.driverError.detail : '(no detail)';
      this.logger.error(`Group creation failed (Postgres ${err.driverError.code}): ${detail}`);
      return;
    }
    if (err instanceof Error) {
      this.logger.error(`Group creation failed: ${err.message}`, err.stack);
      return;
    }
    this.logger.error(`Group creation failed: ${String(err)}`);
  }

  generateCode(type?: string) {
    // Generates a 6-character random hex string safely using crypto
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    return {
      statusCode: GROUP_API_JSON_STATUS_OK,
      code: code,
    };
  }

  async getUserGroups(req: Request, browserIdHeader: string | undefined) {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
    );
    if (!subject) {
      return { statusCode: GROUP_API_JSON_STATUS_OK, groups: [] };
    }

    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, LECTURER_ROLE_NAME);
    const studentAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, STUDENT_ROLE_NAME);

    if (lecturerAccountId === null && studentAccountId === null) {
      return { statusCode: GROUP_API_JSON_STATUS_OK, groups: [] };
    }

    const qb = this.groupRepository.createQueryBuilder('group');
    
    qb.leftJoin(AccountEntity, 'account', 'group.teacher_account_id = account.id')
      .leftJoin(UserEntity, 'user', 'account.user_id = user.id')
      .select([
        'group.id AS id',
        'group.name AS name',
        'group.image_ref AS image_ref',
        'group.description AS description',
        'user.name AS teacher_name',
        'user.surname AS teacher_surname'
      ]);

    if (studentAccountId !== null) {
      qb.leftJoin(EnrollmentEntity, 'enrollment', 'enrollment.group_id = group.id AND enrollment.student_account_id = :studentId', { studentId: studentAccountId });
    }

    const whereConditions = [];
    if (lecturerAccountId !== null) {
      whereConditions.push('group.teacher_account_id = :lecturerId');
      qb.setParameter('lecturerId', lecturerAccountId);
    }
    if (studentAccountId !== null) {
      whereConditions.push('enrollment.id IS NOT NULL');
    }

    qb.where(`(${whereConditions.join(' OR ')})`);

    const rawGroups = await qb.getRawMany();

    const mappedGroups = rawGroups.map(row => {
      const teacherName = row.teacher_name ? String(row.teacher_name).trim() : '';
      const teacherSurname = row.teacher_surname ? String(row.teacher_surname).trim() : '';
      const lecturers = `${teacherName} ${teacherSurname}`.trim();

      return {
        id: row.id + GROUP_RESPONSE_GROUP_ID_OFFSET,
        groupName: row.name,
        subjectName: row.name, // Zmapowane podwójnie
        bannerId: row.image_ref ?? null, // Zmapowane imageRef jako bannerId
        lecturers: lecturers || 'Brak danych',
        description: row.description ?? null
      };
    });

    return { statusCode: GROUP_API_JSON_STATUS_OK, groups: mappedGroups };
  }
}
