import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import {
  GROUP_API_JSON_STATUS_OK,
  GROUP_RESPONSE_GROUP_ID_OFFSET,
  GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID,
  GROUP_RESPONSE_GROUP_NOT_CREATED_ID,
  toInternalGroupId,
} from '../constants/group-api-constants';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { GroupAuthorizationService } from './group-authorization.service';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

export type GetCurrencyResponseBody = {
  statusCode: number;
  groupId: number;
  currency: string | null;
  currencyEmoji: string | null;
};

export type UpdateCurrencyResponseBody = {
  statusCode: number;
  groupId: number;
  currency: string | null;
  currencyEmoji: string | null;
  updated: boolean;
};

function nullableTrimmedString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Manages currency settings (name and icon) for course groups.
 * Only lecturers who own the group may read or modify these settings.
 */
@Injectable()
export class GroupsCurrencyService {
  private readonly logger = new Logger(GroupsCurrencyService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    private readonly groupAuthorizationService: GroupAuthorizationService) {}

  /**
   * Returns the current currency settings for a group owned by the lecturer.
   */
  async getCurrencySettings(
    req: Request,
    publicGroupId: number,
  ): Promise<GetCurrencyResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      return this.buildGetCurrencyError(GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID);
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
    if (lecturerAccountId === null) {
      return this.buildGetCurrencyError(GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID);
    }
    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      return this.buildGetCurrencyError(GROUP_RESPONSE_GROUP_NOT_CREATED_ID);
    }
    const group = await this.groupRepository.findOne({
      where: { id: internalGroupId, teacherAccountId: lecturerAccountId },
    });
    if (!group) {
      return this.buildGetCurrencyError(GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID);
    }
    return {
      statusCode: GROUP_API_JSON_STATUS_OK,
      groupId: internalGroupId + GROUP_RESPONSE_GROUP_ID_OFFSET,
      currency: group.currency,
      currencyEmoji: group.currencyEmoji,
    };
  }

  /**
   * Updates the currency name and/or icon for a group owned by the lecturer.
   */
  async updateCurrencySettings(
    req: Request,
    publicGroupId: number,
    body: UpdateCurrencyDto
  ): Promise<UpdateCurrencyResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
    if (!subject) {
      return this.buildUpdateCurrencyError(GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID);
    }

    let internalGroupId: number;
    try {
      internalGroupId = toInternalGroupId(publicGroupId);
    } catch {
      return this.buildUpdateCurrencyError(GROUP_RESPONSE_GROUP_NOT_CREATED_ID);
    }

    try {
      await this.groupAuthorizationService.assertLecturerOwnsGroupFromRequest(req, internalGroupId, body.auth);
    } catch (err: unknown) {
      if (err instanceof ForbiddenException) {
        return this.buildUpdateCurrencyError(GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID);
      }
      throw err;
    }

    const group = await this.groupRepository.findOne({ where: { id: internalGroupId } });
    if (!group) {
      return this.buildUpdateCurrencyError(GROUP_RESPONSE_GROUP_NOT_CREATED_ID);
    }
    const updates: Partial<GroupEntity> = {};
    if (body.currency !== undefined) {
      updates.currency = nullableTrimmedString(body.currency);
    }
    if (body.currencyEmoji !== undefined) {
      updates.currencyEmoji = nullableTrimmedString(body.currencyEmoji);
    }
    if (Object.keys(updates).length === 0) {
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        groupId: internalGroupId + GROUP_RESPONSE_GROUP_ID_OFFSET,
        currency: group.currency,
        currencyEmoji: group.currencyEmoji,
        updated: false,
      };
    }
    try {
      await this.groupRepository.update({ id: internalGroupId }, updates);
      return {
        statusCode: GROUP_API_JSON_STATUS_OK,
        groupId: internalGroupId + GROUP_RESPONSE_GROUP_ID_OFFSET,
        currency: updates.currency !== undefined ? updates.currency : group.currency,
        currencyEmoji: updates.currencyEmoji !== undefined ? updates.currencyEmoji : group.currencyEmoji,
        updated: true,
      };
    } catch (err: unknown) {
      this.logCurrencyUpdateFailure(err);
      return this.buildUpdateCurrencyError(GROUP_RESPONSE_GROUP_NOT_CREATED_ID);
    }
  }

  private buildGetCurrencyError(groupId: number): GetCurrencyResponseBody {
    return {
      statusCode: GROUP_API_JSON_STATUS_OK,
      groupId,
      currency: null,
      currencyEmoji: null,
    };
  }

  private buildUpdateCurrencyError(groupId: number): UpdateCurrencyResponseBody {
    return {
      statusCode: GROUP_API_JSON_STATUS_OK,
      groupId,
      currency: null,
      currencyEmoji: null,
      updated: false,
    };
  }

  private logCurrencyUpdateFailure(err: unknown): void {
    if (err instanceof Error) {
      this.logger.error(`Currency update failed: ${err.message}`, err.stack);
      return;
    }
    this.logger.error(`Currency update failed: ${String(err)}`);
  }
}
