import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { QueryFailedError, Repository } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
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
import { AvatarEntity } from '../database/entities/avatar.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserEntity } from '../database/entities/user.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { CreateGroupBodyDto } from './dto/create-group-body.dto';
import { GenerateCodeBodyDto } from './dto/generate-code-body.dto';
import { UpdateGroupBodyDto } from './dto/update-group-body.dto';
import { UpdateLivesConfigDto } from './dto/update-lives-config.dto';
import { UpdateShopStatusDto } from './dto/update-shop-status.dto';
import { EnrollmentCodesService } from './enrollment-codes-service';
import { ShopItemsService } from '../gamification/shop-items-service';
import { BacklogService } from '../backlog/backlog-service';
import { formatLecturerDisplay as buildLecturerDisplayLabel } from '../utils/lecturer-display.util';

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
  lecturerAvatarUrl: string | null;
  description: string | null;
  currency: string | null;
  currencyEmoji: string | null;
  shopOpen: boolean;
  livesEnabled: boolean;
  lives: number | null;
  startingLives: number | null;
  livesLabel: string | null;
  livesIcon: string | null;
  livesShopEnabled: boolean;
  shopOpensAt: string | null;
  rankShowMemberAvatars: boolean;
};

export type LivesConfigResponseBody = {
  livesEnabled: boolean;
  livesMax: number | null;
  startingLives: number | null;
  livesLabel: string | null;
  livesIcon: string | null;
  livesShopEnabled: boolean;
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
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    private readonly enrollmentCodesService: EnrollmentCodesService,
    private readonly shopItemsService: ShopItemsService,
    private readonly backlogService: BacklogService,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>) { }

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
    body: CreateGroupBodyDto): Promise<CreateGroupResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
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
      const finalLives = groupPayload.lives ?? null;
      const finalStartingLives = groupPayload.startingLives ?? groupPayload.lives ?? 3;

      if (finalLives !== null && finalStartingLives !== null && finalStartingLives > finalLives) {
        throw new BadRequestException('startingLives must not exceed lives (max cap)');
      }

      let initialShopOpen = true;
      let parsedShopOpensAt: Date | null = null;
      if (groupPayload.shopOpensAt) {
        const d = new Date(groupPayload.shopOpensAt);
        if (d <= new Date()) {
          initialShopOpen = true;
          parsedShopOpensAt = null;
        } else {
          initialShopOpen = false;
          parsedShopOpensAt = d;
        }
      }

      const entity = this.groupRepository.create({
        teacherAccountId: lecturerAccountId,
        name: nameTrimmed,
        subjectName: nullableTrimmedString(groupPayload.subjectName),
        description: nullableTrimmedString(groupPayload.description),
        currency: nullableTrimmedString(groupPayload.currency),
        currencyEmoji: nullableTrimmedString(groupPayload.currencyEmoji),
        lives: finalLives,
        startingLives: finalStartingLives,
        livesIcon: nullableTrimmedString(groupPayload.livesIcon),
        imageRef: nullableTrimmedString(groupPayload.imageRef),
        shopOpen: initialShopOpen,
        shopOpensAt: parsedShopOpensAt,
        rankShowMemberAvatars: groupPayload.rankShowMemberAvatars ?? true,
      });
      const saved = await this.groupRepository.save(entity);
      await this.shopItemsService.ensureDefaultExtraLifeItem(saved.id);
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        group: saved.id + GROUP_RESPONSE_GROUP_ID_OFFSET,
      };
    } catch (err: unknown) {
      if (err instanceof BadRequestException) {
        throw err;
      }
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
    body: UpdateGroupBodyDto): Promise<UpdateGroupResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
    if (!subject) {
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        group: GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID,
        updated: false,
      };
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
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
    if (payload.currencyEmoji !== undefined) {
      updates.currencyEmoji = nullableTrimmedString(payload.currencyEmoji);
    }
    if (payload.lives !== undefined) {
      updates.lives = payload.lives;
    }
    if (payload.startingLives !== undefined) {
      updates.startingLives = payload.startingLives;
    }
    if (payload.livesIcon !== undefined) {
      updates.livesIcon = nullableTrimmedString(payload.livesIcon);
    }
    if (payload.imageRef !== undefined) {
      updates.imageRef = nullableTrimmedString(payload.imageRef);
    }
    if (payload.shopOpensAt !== undefined) {
      if (payload.shopOpensAt === null) {
        updates.shopOpensAt = null;
      } else {
        const d = new Date(payload.shopOpensAt);
        if (d <= new Date()) {
          updates.shopOpen = true;
          updates.shopOpensAt = null;
        } else {
          updates.shopOpensAt = d;
          updates.shopOpen = false;
        }
      }
    }
    if (payload.rankShowMemberAvatars !== undefined) {
      updates.rankShowMemberAvatars = payload.rankShowMemberAvatars;
    }

    if (updates.startingLives !== undefined || updates.lives !== undefined) {
      const finalStartingLives = updates.startingLives !== undefined ? updates.startingLives : existing.startingLives;
      const finalLives = updates.lives !== undefined ? updates.lives : existing.lives;
      if (finalLives !== null && finalStartingLives !== null && finalStartingLives > finalLives) {
        throw new BadRequestException('startingLives must not exceed lives (max cap)');
      }
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
    body: UpdateShopStatusDto): Promise<UpdateGroupResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
    if (!subject) {
      throw new UnauthorizedException('Missing or invalid session');
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
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
      await this.backlogService.notifyEnrolledStudents(internalGroupId, 'SHOP_STATUS_CHANGED', {
        message: body.shopOpen ? 'Sklep grupy został otwarty.' : 'Sklep grupy został zamknięty.',
        shopOpen: body.shopOpen,
      });
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

  /**
   * Updates the lives system configuration for a group owned by the lecturer.
   */
  async updateLivesConfig(
    req: Request,
    publicGroupId: number,
    body: UpdateLivesConfigDto): Promise<UpdateGroupResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
    if (!subject) {
      throw new UnauthorizedException('Missing or invalid session');
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
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

    const updates: Partial<GroupEntity> = {};
    if (body.livesEnabled !== undefined) {
      updates.livesEnabled = body.livesEnabled;
    }
    if (body.lives !== undefined) {
      updates.lives = body.lives;
    }
    if (body.startingLives !== undefined) {
      updates.startingLives = body.startingLives;
    }
    if (body.livesLabel !== undefined) {
      updates.livesLabel = nullableTrimmedString(body.livesLabel);
    }
    if (body.livesIcon !== undefined) {
      updates.livesIcon = nullableTrimmedString(body.livesIcon);
    }
    if (body.livesShopEnabled !== undefined) {
      updates.livesShopEnabled = body.livesShopEnabled;
    }

    if (Object.keys(updates).length === 0) {
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        group: internalGroupId + GROUP_RESPONSE_GROUP_ID_OFFSET,
        updated: false,
      };
    }

    const effectiveLives = updates.lives !== undefined ? updates.lives : existing.lives;
    const effectiveStarting = updates.startingLives !== undefined ? updates.startingLives : existing.startingLives;
    if (effectiveLives !== null && effectiveStarting !== null && effectiveStarting > effectiveLives) {
      throw new BadRequestException('startingLives must not exceed lives (max cap)');
    }

    try {
      await this.groupRepository.update({ id: internalGroupId }, updates);
      if (body.livesEnabled !== undefined) {
        await this.backlogService.notifyEnrolledStudents(internalGroupId, 'LIVES_SYSTEM_CHANGED', {
          message: body.livesEnabled ? 'System żyć został włączony.' : 'System żyć został wyłączony.',
          livesEnabled: body.livesEnabled,
        });
      } else if (body.livesShopEnabled !== undefined) {
        await this.backlogService.notifyEnrolledStudents(internalGroupId, 'LIVES_SYSTEM_CHANGED', {
          message: body.livesShopEnabled
            ? 'Możliwość kupowania żyć w sklepie została włączona.'
            : 'Możliwość kupowania żyć w sklepie została wyłączona.',
          livesShopEnabled: body.livesShopEnabled,
        });
      }
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        group: internalGroupId + GROUP_RESPONSE_GROUP_ID_OFFSET,
        updated: true,
      };
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.logger.error(`updateLivesConfig failed: ${err.message}`, err.stack);
      } else {
        this.logger.error(`updateLivesConfig failed: ${String(err)}`);
      }
      throw new InternalServerErrorException('Database update failed');
    }
  }

  /**
   * Returns the lives configuration for a group.
   * Accessible by both the lecturer (owner) and enrolled students.
   */
  async getLivesConfig(
    req: Request,
    publicGroupId: number,
  ): Promise<LivesConfigResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      throw new UnauthorizedException('Missing or invalid session');
    }

    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      throw new BadRequestException('Invalid group ID');
    }

    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
    const studentAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      STUDENT_ROLE_NAME);

    const rows = await this.fetchAllGroupsWithMembershipFlags(
      lecturerAccountId,
      studentAccountId,
      internalGroupId);
    const row = rows[0];
    if (!row) {
      throw new BadRequestException('Group not found');
    }

    const isOwner = Boolean(row.is_owner);
    const isEnrolled = Boolean(row.is_enrolled);
    if (!isOwner && !isEnrolled) {
      throw new ForbiddenException('Access denied');
    }

    return {
      livesEnabled: row.lives_enabled,
      livesMax: row.lives,
      startingLives: row.starting_lives,
      livesLabel: row.lives_label,
      livesIcon: row.lives_icon,
      livesShopEnabled: row.lives_shop_enabled,
    };
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
  ): Promise<GenerateCodeResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      return this.buildGenerateCodeError(GENERATE_CODE_RESULT_NOT_AUTHORIZED);
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
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
    body: GenerateCodeBodyDto): Promise<GenerateCodeResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
    if (!subject) {
      return this.buildGenerateCodeError(GENERATE_CODE_RESULT_NOT_AUTHORIZED);
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
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

  async getUserGroups(req: Request): Promise<GetUserGroupsResponseBody> {
    const catalog = await this.getGroupsCatalog(req);
    return {
      statusCode: catalog.statusCode,
      groups: catalog.myGroups,
    };
  }

  /**
   * Returns all groups split into membership buckets for the authenticated user.
   */
  async getGroupsCatalog(req: Request): Promise<GetGroupsCatalogResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      return { statusCode: GROUP_API_JSON_STATUS_OK, myGroups: [], otherGroups: [] };
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
    const studentAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      STUDENT_ROLE_NAME);
    const allGroups = await this.fetchAllGroupsWithMembershipFlags(
      lecturerAccountId,
      studentAccountId);
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
  ): Promise<GroupPreviewResponseBody> {
    const empty: GroupPreviewResponseBody = {
      statusCode: GROUP_API_JSON_STATUS_OK,
      group: null,
      hasAccess: false,
      isOwner: false,
      isEnrolled: false,
    };
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
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
      LECTURER_ROLE_NAME);
    const studentAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      STUDENT_ROLE_NAME);
    const rows = await this.fetchAllGroupsWithMembershipFlags(
      lecturerAccountId,
      studentAccountId,
      internalGroupId);
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

  private mapRawGroupRow(row: {
    id: number;
    name: string;
    subject_name: string | null;
    image_ref: string | null;
    description: string | null;
    currency: string | null;
    currency_emoji: string | null;
    teacher_nickname: string | null;
    teacher_name: string | null;
    teacher_surname: string | null;
    teacher_show_nickname: boolean | null;
    teacher_avatar_url: string | null;
    shop_open: boolean;
    shop_opens_at: Date | string | null;
    rank_show_member_avatars: boolean;
    lives_enabled: boolean;
    lives: number | null;
    starting_lives: number | null;
    lives_label: string | null;
    lives_icon: string | null;
    lives_shop_enabled: boolean;
  }): UserGroupListItem {
    const toBool = (v: unknown) => v === true || v === ('t' as unknown) || v === (1 as unknown);
    const lecturers = buildLecturerDisplayLabel(
      row.teacher_nickname,
      row.teacher_name,
      row.teacher_surname,
      row.teacher_show_nickname === undefined || row.teacher_show_nickname === null
        ? true
        : toBool(row.teacher_show_nickname),
    );
    return {
      id: row.id + GROUP_RESPONSE_GROUP_ID_OFFSET,
      groupName: row.name,
      subjectName: row.subject_name ?? '',
      bannerId: row.image_ref ?? null,
      lecturers: lecturers || '',
      lecturerAvatarUrl: row.teacher_avatar_url ?? null,
      description: row.description ?? null,
      currency: row.currency ?? null,
      currencyEmoji: row.currency_emoji ?? null,
      shopOpen: toBool(row.shop_open),
      livesEnabled: toBool(row.lives_enabled),
      lives: row.lives ?? null,
      startingLives: row.starting_lives ?? null,
      livesLabel: row.lives_label ?? null,
      livesIcon: row.lives_icon ?? null,
      livesShopEnabled: toBool(row.lives_shop_enabled),
      shopOpensAt: row.shop_opens_at ? new Date(row.shop_opens_at).toISOString() : null,
      rankShowMemberAvatars: toBool(row.rank_show_member_avatars),
    };
  }

  private async fetchAllGroupsWithMembershipFlags(
    lecturerAccountId: number | null,
    studentAccountId: number | null,
    internalGroupId?: number): Promise<
    Array<{
      id: number;
      name: string;
      subject_name: string | null;
      image_ref: string | null;
      description: string | null;
      currency: string | null;
      currency_emoji: string | null;
      teacher_nickname: string | null;
      teacher_name: string | null;
      teacher_surname: string | null;
      teacher_show_nickname: boolean | null;
      teacher_avatar_url: string | null;
      shop_open: boolean;
      shop_opens_at: Date | string | null;
      rank_show_member_avatars: boolean;
      lives_enabled: boolean;
      lives: number | null;
      starting_lives: number | null;
      lives_label: string | null;
      lives_icon: string | null;
      lives_shop_enabled: boolean;
      is_owner: boolean;
      is_enrolled: boolean;
    }>
  > {
    const qb = this.groupRepository.createQueryBuilder('group');
    qb.leftJoin(AccountEntity, 'account', 'group.teacher_account_id = account.id')
      .leftJoin(UserEntity, 'user', 'account.user_id = user.id')
      .leftJoin(AvatarEntity, 'avatar', 'avatar.id = user.avatar_id')
      .select([
        'group.id AS id',
        'group.name AS name',
        'group.subject_name AS subject_name',
        'group.image_ref AS image_ref',
        'group.description AS description',
        'group.currency AS currency',
        'group.currency_emoji AS currency_emoji',
        'group.shop_open AS shop_open',
        'group.shop_opens_at AS shop_opens_at',
        'group.rank_show_member_avatars AS rank_show_member_avatars',
        'group.lives_enabled AS lives_enabled',
        'group.lives AS lives',
        'group.starting_lives AS starting_lives',
        'group.lives_label AS lives_label',
        'group.lives_icon AS lives_icon',
        'group.lives_shop_enabled AS lives_shop_enabled',
        'user.nickname AS teacher_nickname',
        'user.name AS teacher_name',
        'user.surname AS teacher_surname',
        'user.show_nickname AS teacher_show_nickname',
        'avatar.image_url AS teacher_avatar_url',
      ]);
    if (studentAccountId !== null) {
      qb.leftJoin(
        EnrollmentEntity,
        'enrollment',
        'enrollment.group_id = group.id AND enrollment.student_account_id = :studentId',
        { studentId: studentAccountId });
      qb.addSelect('CASE WHEN enrollment.id IS NOT NULL THEN true ELSE false END', 'is_enrolled');
    } else {
      qb.addSelect('false', 'is_enrolled');
    }
    if (lecturerAccountId !== null) {
      qb.addSelect(
        'CASE WHEN group.teacher_account_id = :lecturerId THEN true ELSE false END',
        'is_owner');
      qb.setParameter('lecturerId', lecturerAccountId);
    } else {
      qb.addSelect('false', 'is_owner');
    }
    if (internalGroupId !== undefined) {
      qb.andWhere('group.id = :groupId', { groupId: internalGroupId });
    }
    qb.orderBy('group.name', 'ASC');
    const rawGroups = await qb.getRawMany();
    const toBool = (v: unknown) => v === true || v === 't' || v === 1;
    return rawGroups.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      subject_name: row.subject_name ?? null,
      image_ref: row.image_ref ?? null,
      description: row.description ?? null,
      currency: row.currency ?? null,
      currency_emoji: row.currency_emoji ?? null,
      teacher_nickname: row.teacher_nickname ?? null,
      teacher_name: row.teacher_name ?? null,
      teacher_surname: row.teacher_surname ?? null,
      teacher_show_nickname: toBool(row.teacher_show_nickname),
      teacher_avatar_url: row.teacher_avatar_url ?? null,
      shop_open: toBool(row.shop_open),
      lives_enabled: toBool(row.lives_enabled),
      lives: row.lives ?? null,
      starting_lives: row.starting_lives ?? null,
      lives_label: row.lives_label ?? null,
      lives_icon: row.lives_icon ?? null,
      lives_shop_enabled: toBool(row.lives_shop_enabled),
      shop_opens_at: row.shop_opens_at ? new Date(row.shop_opens_at) : null,
      rank_show_member_avatars: toBool(row.rank_show_member_avatars),
      is_owner: toBool(row.is_owner),
      is_enrolled: toBool(row.is_enrolled),
    }));
  }
}
