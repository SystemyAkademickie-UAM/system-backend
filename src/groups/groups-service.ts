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
  toInternalGroupId,
} from '../constants/group-api-constants';
import {
  GENERATE_CODE_RESULT_DB_ERROR,
  GENERATE_CODE_RESULT_GROUP_NOT_FOUND,
  GENERATE_CODE_RESULT_NOT_AUTHORIZED,
  GROUP_ENTRY_CODE_GENERATED_BYTE_LENGTH,
  GROUP_ENTRY_CODE_GENERATION_MAX_ATTEMPTS,
  GROUP_GENERATE_CODE_API_JSON_STATUS_OK,
} from '../constants/group-generate-code-api-constants';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { AccountEntity } from '../database/entities/account.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserEntity } from '../database/entities/user.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { CreateGroupBodyDto } from './dto/create-group-body.dto';
import { GenerateCodeBodyDto } from './dto/generate-code-body.dto';

export type CreateGroupResponseBody = { statusCode: number; group: number };

export type GenerateCodeResponseBody = {
  statusCode: number;
  code: string;
  groupId: number;
};

export type UserGroupListItem = {
  id: number;
  groupName: string;
  subjectName: string;
  bannerId: string | null;
  lecturers: string;
  description: string | null;
};

export type GetUserGroupsResponseBody = {
  statusCode: number;
  groups: UserGroupListItem[];
};

export type GetGroupsCatalogResponseBody = {
  statusCode: number;
  myGroups: UserGroupListItem[];
  otherGroups: UserGroupListItem[];
};

export type GroupPreviewResponseBody = {
  statusCode: number;
  group: UserGroupListItem | null;
  hasAccess: boolean;
  isOwner: boolean;
  isEnrolled: boolean;
};

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
  ) {}

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

  async getAccessCodeForGroup(
    req: Request,
    publicGroupId: number,
    browserIdHeader: string | undefined,
    queryAuth: string | undefined,
  ): Promise<GenerateCodeResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      queryAuth,
    );
    if (!subject) {
      return this.buildGenerateCodeError(GENERATE_CODE_RESULT_NOT_AUTHORIZED);
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME,
    );
    if (lecturerAccountId === null) {
      return this.buildGenerateCodeError(GENERATE_CODE_RESULT_NOT_AUTHORIZED);
    }
    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      return this.buildGenerateCodeError(GENERATE_CODE_RESULT_GROUP_NOT_FOUND);
    }
    const group = await this.groupRepository.findOne({
      where: { id: internalGroupId, teacherAccountId: lecturerAccountId },
    });
    if (!group) {
      const groupExists = await this.groupRepository.exist({ where: { id: internalGroupId } });
      if (!groupExists) {
        return this.buildGenerateCodeError(GENERATE_CODE_RESULT_GROUP_NOT_FOUND);
      }
      return this.buildGenerateCodeError(GENERATE_CODE_RESULT_NOT_AUTHORIZED);
    }
    return {
      statusCode: GROUP_GENERATE_CODE_API_JSON_STATUS_OK,
      code: group.entryCode ?? '',
      groupId: internalGroupId + GROUP_RESPONSE_GROUP_ID_OFFSET,
    };
  }

  async generateCodeForGroup(
    req: Request,
    body: GenerateCodeBodyDto,
    browserIdHeader: string | undefined,
  ): Promise<GenerateCodeResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      body.auth,
    );
    if (!subject) {
      return this.buildGenerateCodeError(GENERATE_CODE_RESULT_NOT_AUTHORIZED);
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME,
    );
    if (lecturerAccountId === null) {
      return this.buildGenerateCodeError(GENERATE_CODE_RESULT_NOT_AUTHORIZED);
    }
    const publicGroupId = body.groupId;
    const internalGroupId =
      publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
        ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
        : publicGroupId;
    const group = await this.groupRepository.findOne({
      where: { id: internalGroupId, teacherAccountId: lecturerAccountId },
    });
    if (!group) {
      const groupExists = await this.groupRepository.exist({ where: { id: internalGroupId } });
      if (!groupExists) {
        return this.buildGenerateCodeError(GENERATE_CODE_RESULT_GROUP_NOT_FOUND);
      }
      return this.buildGenerateCodeError(GENERATE_CODE_RESULT_NOT_AUTHORIZED);
    }
    try {
      const code = await this.persistUniqueEntryCode(group);
      if (code === null) {
        return this.buildGenerateCodeError(GENERATE_CODE_RESULT_DB_ERROR);
      }
      return {
        statusCode: GROUP_GENERATE_CODE_API_JSON_STATUS_OK,
        code,
        groupId: internalGroupId + GROUP_RESPONSE_GROUP_ID_OFFSET,
      };
    } catch (err: unknown) {
      this.logGenerateCodeFailure(err);
      return this.buildGenerateCodeError(GENERATE_CODE_RESULT_DB_ERROR);
    }
  }

  private buildGenerateCodeError(groupId: number): GenerateCodeResponseBody {
    return {
      statusCode: GROUP_GENERATE_CODE_API_JSON_STATUS_OK,
      code: '',
      groupId,
    };
  }

  private buildRandomEntryCode(): string {
    return crypto.randomBytes(GROUP_ENTRY_CODE_GENERATED_BYTE_LENGTH).toString('hex').toUpperCase();
  }

  private async persistUniqueEntryCode(group: GroupEntity): Promise<string | null> {
    for (let attempt = 0; attempt < GROUP_ENTRY_CODE_GENERATION_MAX_ATTEMPTS; attempt += 1) {
      const code = this.buildRandomEntryCode();
      const taken = await this.groupRepository.exist({ where: { entryCode: code } });
      if (taken) {
        continue;
      }
      group.entryCode = code;
      await this.groupRepository.save(group);
      return code;
    }
    return null;
  }

  private logGenerateCodeFailure(err: unknown): void {
    if (postgresFkViolation(err)) {
      const detail =
        typeof err.driverError.detail === 'string' ? err.driverError.detail : '(no detail)';
      this.logger.error(`Group entry code generation failed (Postgres ${err.driverError.code}): ${detail}`);
      return;
    }
    if (err instanceof Error) {
      this.logger.error(`Group entry code generation failed: ${err.message}`, err.stack);
      return;
    }
    this.logger.error(`Group entry code generation failed: ${String(err)}`);
  }

  async getUserGroups(
    req: Request,
    browserIdHeader: string | undefined,
    queryAuth: string | undefined,
  ): Promise<GetUserGroupsResponseBody> {
    const catalog = await this.getGroupsCatalog(req, browserIdHeader, queryAuth);
    return {
      statusCode: catalog.statusCode,
      groups: catalog.myGroups,
    };
  }

  /**
   * Returns all groups split into membership buckets for the authenticated user.
   */
  async getGroupsCatalog(
    req: Request,
    browserIdHeader: string | undefined,
    queryAuth: string | undefined,
  ): Promise<GetGroupsCatalogResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      queryAuth,
    );
    if (!subject) {
      return { statusCode: GROUP_API_JSON_STATUS_OK, myGroups: [], otherGroups: [] };
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME,
    );
    const studentAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      STUDENT_ROLE_NAME,
    );
    const allGroups = await this.fetchAllGroupsWithMembershipFlags(
      lecturerAccountId,
      studentAccountId,
    );
    const myGroups: UserGroupListItem[] = [];
    const otherGroups: UserGroupListItem[] = [];
    for (const row of allGroups) {
      const item = this.mapRawGroupRow(row);
      if (row.is_owner || row.is_enrolled) {
        myGroups.push(item);
      } else {
        otherGroups.push(item);
      }
    }
    return { statusCode: GROUP_API_JSON_STATUS_OK, myGroups, otherGroups };
  }

  /**
   * Returns public group metadata and access flags for the authenticated user.
   */
  async getGroupPreview(
    req: Request,
    publicGroupId: number,
    browserIdHeader: string | undefined,
    queryAuth: string | undefined,
  ): Promise<GroupPreviewResponseBody> {
    const empty: GroupPreviewResponseBody = {
      statusCode: GROUP_API_JSON_STATUS_OK,
      group: null,
      hasAccess: false,
      isOwner: false,
      isEnrolled: false,
    };
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      queryAuth,
    );
    if (!subject) {
      return empty;
    }
    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      return empty;
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME,
    );
    const studentAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      STUDENT_ROLE_NAME,
    );
    const rows = await this.fetchAllGroupsWithMembershipFlags(
      lecturerAccountId,
      studentAccountId,
      internalGroupId,
    );
    const row = rows[0];
    if (!row) {
      return empty;
    }
    const isOwner = Boolean(row.is_owner);
    const isEnrolled = Boolean(row.is_enrolled);
    return {
      statusCode: GROUP_API_JSON_STATUS_OK,
      group: this.mapRawGroupRow(row),
      hasAccess: isOwner || isEnrolled,
      isOwner,
      isEnrolled,
    };
  }

  private formatLecturerDisplay(
    nickname: string | null | undefined,
    name: string | null | undefined,
    surname: string | null | undefined,
  ): string {
    const nick = nickname ? String(nickname).trim() : '';
    const legal = [name, surname]
      .filter(Boolean)
      .map((part) => String(part).trim())
      .join(' ')
      .trim();

    if (nick && legal && nick.toLowerCase() !== legal.toLowerCase()) {
      return `${nick} (${legal})`;
    }
    if (nick) {
      return nick;
    }
    return legal;
  }

  private mapRawGroupRow(row: {
    id: number;
    name: string;
    image_ref: string | null;
    description: string | null;
    teacher_nickname: string | null;
    teacher_name: string | null;
    teacher_surname: string | null;
  }): UserGroupListItem {
    const lecturers = this.formatLecturerDisplay(
      row.teacher_nickname,
      row.teacher_name,
      row.teacher_surname,
    );
    return {
      id: row.id + GROUP_RESPONSE_GROUP_ID_OFFSET,
      groupName: row.name,
      subjectName: row.name,
      bannerId: row.image_ref ?? null,
      lecturers: lecturers || '',
      description: row.description ?? null,
    };
  }

  private async fetchAllGroupsWithMembershipFlags(
    lecturerAccountId: number | null,
    studentAccountId: number | null,
    internalGroupId?: number,
  ): Promise<
    Array<{
      id: number;
      name: string;
      image_ref: string | null;
      description: string | null;
      teacher_nickname: string | null;
      teacher_name: string | null;
      teacher_surname: string | null;
      is_owner: boolean;
      is_enrolled: boolean;
    }>
  > {
    const qb = this.groupRepository.createQueryBuilder('group');
    qb.leftJoin(AccountEntity, 'account', 'group.teacher_account_id = account.id')
      .leftJoin(UserEntity, 'user', 'account.user_id = user.id')
      .select([
        'group.id AS id',
        'group.name AS name',
        'group.image_ref AS image_ref',
        'group.description AS description',
        'user.nickname AS teacher_nickname',
        'user.name AS teacher_name',
        'user.surname AS teacher_surname',
      ]);
    if (studentAccountId !== null) {
      qb.leftJoin(
        EnrollmentEntity,
        'enrollment',
        'enrollment.group_id = group.id AND enrollment.student_account_id = :studentId',
        { studentId: studentAccountId },
      );
      qb.addSelect('CASE WHEN enrollment.id IS NOT NULL THEN true ELSE false END', 'is_enrolled');
    } else {
      qb.addSelect('false', 'is_enrolled');
    }
    if (lecturerAccountId !== null) {
      qb.addSelect(
        'CASE WHEN group.teacher_account_id = :lecturerId THEN true ELSE false END',
        'is_owner',
      );
      qb.setParameter('lecturerId', lecturerAccountId);
    } else {
      qb.addSelect('false', 'is_owner');
    }
    if (internalGroupId !== undefined) {
      qb.andWhere('group.id = :groupId', { groupId: internalGroupId });
    }
    qb.orderBy('group.name', 'ASC');
    const rawGroups = await qb.getRawMany();
    return rawGroups.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      image_ref: row.image_ref ?? null,
      description: row.description ?? null,
      teacher_nickname: row.teacher_nickname ?? null,
      teacher_name: row.teacher_name ?? null,
      teacher_surname: row.teacher_surname ?? null,
      is_owner: row.is_owner === true || row.is_owner === 't' || row.is_owner === 1,
      is_enrolled: row.is_enrolled === true || row.is_enrolled === 't' || row.is_enrolled === 1,
    }));
  }
}
