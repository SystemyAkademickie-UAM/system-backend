import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { QueryFailedError, Repository } from 'typeorm';

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
import { UpdateGroupBodyDto } from './dto/update-group-body.dto';
import { UpdateShopStatusDto } from './dto/update-shop-status.dto';
import { EnrollmentCodesService } from './enrollment-codes-service';

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
  currency: string | null;
  currencyIcon: string | null;
  shopOpen: boolean;
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

export type UpdateGroupResponseBody = {
  statusCode: number;
  group: number;
  updated: boolean;
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
    private readonly enrollmentCodesService: EnrollmentCodesService,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) { }

  async assertLecturerOwnsGroupAndGetAccountId(userId: number, internalGroupId: number): Promise<number> {
    const lecturerAccountId = await this.assertLecturerAndGetAccountId(userId);
    const group = await this.groupRepository.findOne({
      where: { id: internalGroupId, teacherAccountId: lecturerAccountId },
    });
    if (!group) {
      throw new ForbiddenException('Not authorized to manage this group');
    }
    return lecturerAccountId;
  }

  async assertLecturerAndGetAccountId(userId: number): Promise<number> {
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(userId, LECTURER_ROLE_NAME);
    if (lecturerAccountId === null) {
      throw new ForbiddenException('Requires lecturer privileges');
    }
    return lecturerAccountId;
  }

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
        subjectName: nullableTrimmedString(groupPayload.subjectName),
        description: nullableTrimmedString(groupPayload.description),
        currency: nullableTrimmedString(groupPayload.currency),
        currencyIcon: nullableTrimmedString(groupPayload.currencyIcon),
        lives: groupPayload.lives ?? null,
        livesIcon: nullableTrimmedString(groupPayload.livesIcon),
        imageRef: nullableTrimmedString(groupPayload.imageRef),
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

  /**
   * Updates an existing group owned by the lecturer.
   * Only fields present in the payload are written; unset fields are left untouched.
   */
  async updateGroup(
    req: Request,
    publicGroupId: number,
    body: UpdateGroupBodyDto,
    browserIdHeader: string | undefined,
  ): Promise<UpdateGroupResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      body.auth,
    );
    if (!subject) {
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        group: GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID,
        updated: false,
      };
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME,
    );
    if (lecturerAccountId === null) {
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        group: GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID,
        updated: false,
      };
    }

    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        group: GROUP_RESPONSE_GROUP_NOT_CREATED_ID,
        updated: false,
      };
    }

    const existing = await this.groupRepository.findOne({
      where: { id: internalGroupId, teacherAccountId: lecturerAccountId },
    });
    if (!existing) {
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        group: GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID,
        updated: false,
      };
    }

    const payload = body.group ?? {};
    const updates: Partial<GroupEntity> = {};

    if (payload.name !== undefined) {
      const trimmed = String(payload.name ?? '').trim();
      if (trimmed === '') {
        return {
          statusCode: GROUP_API_JSON_STATUS_OK,
          group: GROUP_RESPONSE_GROUP_NOT_CREATED_ID,
          updated: false,
        };
      }
      updates.name = trimmed;
    }
    if (payload.subjectName !== undefined) {
      updates.subjectName = nullableTrimmedString(payload.subjectName);
    }
    if (payload.description !== undefined) {
      updates.description = nullableTrimmedString(payload.description);
    }
    if (payload.currency !== undefined) {
      updates.currency = nullableTrimmedString(payload.currency);
    }
    if (payload.currencyIcon !== undefined) {
      updates.currencyIcon = nullableTrimmedString(payload.currencyIcon);
    }
    if (payload.lives !== undefined) {
      updates.lives = payload.lives;
    }
    if (payload.livesIcon !== undefined) {
      updates.livesIcon = nullableTrimmedString(payload.livesIcon);
    }
    if (payload.imageRef !== undefined) {
      updates.imageRef = nullableTrimmedString(payload.imageRef);
    }

    if (Object.keys(updates).length === 0) {
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        group: internalGroupId + GROUP_RESPONSE_GROUP_ID_OFFSET,
        updated: false,
      };
    }

    try {
      await this.groupRepository.update({ id: internalGroupId }, updates);
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        group: internalGroupId + GROUP_RESPONSE_GROUP_ID_OFFSET,
        updated: true,
      };
    } catch (err: unknown) {
      this.logGroupCreationFailure(err);
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        group: GROUP_RESPONSE_GROUP_NOT_CREATED_ID,
        updated: false,
      };
    }
  }

  /**
   * Updates the shop open/closed status for a group owned by the lecturer.
   */
  async updateShopStatus(
    req: Request,
    publicGroupId: number,
    body: UpdateShopStatusDto,
    browserIdHeader: string | undefined,
  ): Promise<UpdateGroupResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      body.auth,
    );
    if (!subject) {
      throw new UnauthorizedException('Missing or invalid session');
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME,
    );
    if (lecturerAccountId === null) {
      throw new ForbiddenException('Requires lecturer privileges');
    }

    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      throw new BadRequestException('Invalid group ID');
    }

    const existing = await this.groupRepository.findOne({
      where: { id: internalGroupId, teacherAccountId: lecturerAccountId },
    });
    if (!existing) {
      throw new ForbiddenException('Not authorized to manage this group');
    }

    try {
      await this.groupRepository.update({ id: internalGroupId }, { shopOpen: body.shopOpen });
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        group: internalGroupId + GROUP_RESPONSE_GROUP_ID_OFFSET,
        updated: true,
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(`updateShopStatus failed: ${err.message}`, err.stack);
      } else {
        this.logger.error(`updateShopStatus failed: ${String(err)}`);
      }
      throw new InternalServerErrorException('Database update failed');
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
    const latestCode = await this.enrollmentCodesService.findLatestActiveCode(internalGroupId);
    return {
      statusCode: GROUP_GENERATE_CODE_API_JSON_STATUS_OK,
      code: latestCode?.code ?? '',
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
      const created = await this.enrollmentCodesService.createCode(req, internalGroupId, { auth: body.auth });
      return {
        statusCode: GROUP_GENERATE_CODE_API_JSON_STATUS_OK,
        code: created.code,
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
    subject_name: string | null;
    image_ref: string | null;
    description: string | null;
    currency: string | null;
    currency_icon: string | null;
    teacher_nickname: string | null;
    teacher_name: string | null;
    teacher_surname: string | null;
    shop_open: boolean;
  }): UserGroupListItem {
    const lecturers = this.formatLecturerDisplay(
      row.teacher_nickname,
      row.teacher_name,
      row.teacher_surname,
    );
    return {
      id: row.id + GROUP_RESPONSE_GROUP_ID_OFFSET,
      groupName: row.name,
      subjectName: row.subject_name ?? '',
      bannerId: row.image_ref ?? null,
      lecturers: lecturers || '',
      description: row.description ?? null,
      currency: row.currency ?? null,
      currencyIcon: row.currency_icon ?? null,
      shopOpen: row.shop_open === true || row.shop_open === ('t' as unknown) || row.shop_open === (1 as unknown),
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
      subject_name: string | null;
      image_ref: string | null;
      description: string | null;
      currency: string | null;
      currency_icon: string | null;
      teacher_nickname: string | null;
      teacher_name: string | null;
      teacher_surname: string | null;
      shop_open: boolean;
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
        'group.subject_name AS subject_name',
        'group.image_ref AS image_ref',
        'group.description AS description',
        'group.currency AS currency',
        'group.currency_icon AS currency_icon',
        'group.shop_open AS shop_open',
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
      subject_name: row.subject_name ?? null,
      image_ref: row.image_ref ?? null,
      description: row.description ?? null,
      currency: row.currency ?? null,
      currency_icon: row.currency_icon ?? null,
      teacher_nickname: row.teacher_nickname ?? null,
      teacher_name: row.teacher_name ?? null,
      teacher_surname: row.teacher_surname ?? null,
      shop_open: row.shop_open === true || row.shop_open === ('t' as unknown) || row.shop_open === (1 as unknown),
      is_owner: row.is_owner === true || row.is_owner === 't' || row.is_owner === 1,
      is_enrolled: row.is_enrolled === true || row.is_enrolled === 't' || row.is_enrolled === 1,
    }));
  }
}
