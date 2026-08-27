import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository, DataSource, In } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import {
  STAGE_API_JSON_STATUS_BAD_REQUEST,
  STAGE_API_JSON_STATUS_FORBIDDEN,
  STAGE_API_JSON_STATUS_OK,
  STAGE_RESPONSE_NOT_AUTHORIZED_ID,
  STAGE_RESPONSE_NOT_CREATED_ID,
  STAGE_RESPONSE_NOT_FOUND_ID,
  type StageMethod,
} from '../constants/stage-api-constants';
import { GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { ActivityBacklogEntity } from '../database/entities/activity-backlog.entity';
import { ActivityEntity } from '../database/entities/activity.entity';
import { StageEntity } from '../database/entities/stage.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { GroupAuthorizationService } from '../groups/group-authorization.service';
import { BacklogService } from '../backlog/backlog-service';
import { parseStageRequest, type ParsedStageRequest } from './stage-request-parser';

export type StageResponseBody = {
  statusCode: number;
  method: StageMethod;
  stage: number;
  stages?: Array<{ id: number; groupId: number; name: string; visibilityStatus: number; displayOrder: number | null }>;
};

function toInternalGroupId(publicGroupId: number): number {
  return publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
    ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
    : publicGroupId;
}

function toPublicGroupId(internalGroupId: number): number {
  return internalGroupId + GROUP_RESPONSE_GROUP_ID_OFFSET;
}

@Injectable()
export class StagesService {
  private readonly logger = new Logger(StagesService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    private readonly dataSource: DataSource,
    @InjectRepository(StageEntity)
    private readonly stageRepository: Repository<StageEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    private readonly backlogService: BacklogService,
    private readonly groupAuthorizationService: GroupAuthorizationService) {}

  async handleStage(
    req: Request,
    body: unknown): Promise<StageResponseBody> {
    const parsed = parseStageRequest(body);
    if (!parsed.ok) {
      return {
        statusCode: STAGE_API_JSON_STATUS_BAD_REQUEST,
        method: parsed.method,
        stage: parsed.stage,
      };
    }
    const request = parsed.request;
    const method = request.method;
    if (method === 'post') {
      return this.createStage(req, request);
    }
    if (method === 'modify') {
      return this.modifyStage(req, request);
    }
    if (method === 'remove') {
      return this.removeStage(req, request);
    }
    if (method === 'reorder') {
      return this.reorderStages(req, request);
    }
    return this.retrieveStages(req, request);
  }

  private async createStage(
    req: Request,
    body: ParsedStageRequest): Promise<StageResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
    if (!subject) {
      return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'post', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'post', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    if (!body.groupId || !body.name) {
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'post', stage: STAGE_RESPONSE_NOT_CREATED_ID };
    }
    const internalGroupId = toInternalGroupId(body.groupId);
    const groupExists = await this.groupRepository.exist({ where: { id: internalGroupId } });
    if (!groupExists) {
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'post', stage: STAGE_RESPONSE_NOT_CREATED_ID };
    }
    try {
      await this.groupAuthorizationService.assertLecturerOwnsGroup(subject.userId, internalGroupId);
      const entity = this.stageRepository.create({
        groupId: internalGroupId,
        name: body.name.trim(),
        visibilityStatus: body.visibilityStatus ?? 0, // Default to hidden (0) if not provided
      });
      const saved = await this.stageRepository.save(entity);
      await this.backlogService.notifyEnrolledStudents(internalGroupId, 'STAGE_ADDED', {
        message: `Dodano nowy etap: ${saved.name}.`,
        stageId: saved.id,
        stageName: saved.name,
      });
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'post', stage: saved.id };
    } catch (err) {
      if (err instanceof ForbiddenException) {
        return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'post', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
      }
      this.logger.error(`Stage creation failed: ${err instanceof Error ? err.message : String(err)}`);
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'post', stage: STAGE_RESPONSE_NOT_CREATED_ID };
    }
  }

  private async modifyStage(
    req: Request,
    body: ParsedStageRequest): Promise<StageResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
    if (!subject) {
      return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'modify', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'modify', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    if (!body.stageId) {
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'modify', stage: STAGE_RESPONSE_NOT_FOUND_ID };
    }
    const existing = await this.stageRepository.findOne({ where: { id: body.stageId } });
    if (!existing) {
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'modify', stage: STAGE_RESPONSE_NOT_FOUND_ID };
    }
    try {
      await this.groupAuthorizationService.assertLecturerOwnsGroup(subject.userId, existing.groupId);
      if (body.name !== undefined) {
        existing.name = body.name.trim();
      }
      if (body.groupId !== undefined) {
        existing.groupId = toInternalGroupId(body.groupId);
      }
      if (body.visibilityStatus !== undefined) {
        existing.visibilityStatus = body.visibilityStatus;
      }
      if (body.displayOrder !== undefined) {
        existing.displayOrder = body.displayOrder;
      }
      await this.stageRepository.save(existing);
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'modify', stage: existing.id };
    } catch (err) {
      if (err instanceof ForbiddenException) {
        return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'modify', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
      }
      this.logger.error(`Stage modification failed: ${err instanceof Error ? err.message : String(err)}`);
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'modify', stage: STAGE_RESPONSE_NOT_FOUND_ID };
    }
  }

  private async removeStage(
    req: Request,
    body: ParsedStageRequest): Promise<StageResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
    if (!subject) {
      return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'remove', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'remove', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    if (!body.stageId) {
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'remove', stage: STAGE_RESPONSE_NOT_FOUND_ID };
    }
    const existing = await this.stageRepository.findOne({ where: { id: body.stageId } });
    if (!existing) {
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'remove', stage: STAGE_RESPONSE_NOT_FOUND_ID };
    }
    try {
      await this.groupAuthorizationService.assertLecturerOwnsGroup(subject.userId, existing.groupId);
      const deleted = await this.deleteStageAndLinkedRows(body.stageId);
      if (!deleted) {
        return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'remove', stage: STAGE_RESPONSE_NOT_FOUND_ID };
      }
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'remove', stage: body.stageId };
    } catch (err) {
      if (err instanceof ForbiddenException) {
        return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'remove', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
      }
      this.logger.error(`Stage removal failed: ${err instanceof Error ? err.message : String(err)}`);
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'remove', stage: STAGE_RESPONSE_NOT_FOUND_ID };
    }
  }

  /**
   * Deletes a stage and its activities (and activity completion rows) in one transaction.
   * PostgreSQL rejects a bare stage DELETE while `education.activities.stage_id` still points at it.
   */
  private async deleteStageAndLinkedRows(stageId: number): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const activities = await queryRunner.manager.find(ActivityEntity, {
        where: { stageId },
        select: ['id'],
      });
      const activityIds = activities.map((activity) => activity.id);
      if (activityIds.length > 0) {
        await queryRunner.manager.delete(ActivityBacklogEntity, { activityId: In(activityIds) });
        await queryRunner.manager.delete(ActivityEntity, { stageId });
      }
      const result = await queryRunner.manager.delete(StageEntity, { id: stageId });
      await queryRunner.commitTransaction();
      return (result.affected ?? 0) > 0;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async retrieveStages(
    req: Request,
    body: ParsedStageRequest): Promise<StageResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
    if (!subject) {
      return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'retrieve', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    let showHiddenStages = false;
    if (isLecturer && body.groupId) {
      showHiddenStages = await this.groupAuthorizationService.isLecturerOwner(
        subject.userId,
        toInternalGroupId(body.groupId));
    } else if (isLecturer && body.stageId) {
      const stageForAccess = await this.stageRepository.findOne({
        where: { id: body.stageId },
        select: ['groupId'],
      });
      if (stageForAccess) {
        showHiddenStages = await this.groupAuthorizationService.isLecturerOwner(
          subject.userId,
          stageForAccess.groupId);
      }
    }
    const visibilityCondition = showHiddenStages ? {} : { visibilityStatus: 1 };

    try {
      let stages: StageEntity[];
      const order = { displayOrder: { direction: 'ASC', nulls: 'LAST' }, id: 'ASC' } as any;
      if (body.groupId) {
        const internalGroupId = toInternalGroupId(body.groupId);
        stages = await this.stageRepository.find({ where: { groupId: internalGroupId, ...visibilityCondition }, order });
      } else if (body.stageId) {
        const single = await this.stageRepository.findOne({ where: { id: body.stageId, ...visibilityCondition } });
        stages = single ? [single] : [];
      } else {
        stages = await this.stageRepository.find({ where: { ...visibilityCondition }, order });
      }
      return {
        statusCode: STAGE_API_JSON_STATUS_OK,
        method: 'retrieve',
        stage: stages.length,
        stages: stages.map((s) => ({
          id: s.id,
          groupId: toPublicGroupId(s.groupId),
          name: s.name,
          visibilityStatus: s.visibilityStatus,
          displayOrder: s.displayOrder ?? null,
        })),
      };
    } catch (err) {
      this.logger.error(`Stage retrieval failed: ${err instanceof Error ? err.message : String(err)}`);
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'retrieve', stage: 0, stages: [] };
    }
  }

  private async reorderStages(
    req: Request,
    body: ParsedStageRequest): Promise<StageResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
    if (!subject) {
      return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'reorder', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'reorder', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    if (!body.groupId || !body.stageIds) {
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'reorder', stage: STAGE_RESPONSE_NOT_FOUND_ID };
    }
    const internalGroupId = toInternalGroupId(body.groupId);
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, LECTURER_ROLE_NAME);
    if (lecturerAccountId === null) {
      return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'reorder', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    try {
      await this.groupAuthorizationService.assertLecturerOwnsGroup(subject.userId, internalGroupId);
    } catch (err) {
      if (err instanceof ForbiddenException) {
        return { statusCode: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'reorder', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
      }
      throw err;
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (let i = 0; i < body.stageIds.length; i++) {
        const id = body.stageIds[i];
        await queryRunner.manager.update(StageEntity, { id, groupId: internalGroupId }, { displayOrder: i });
      }
      await queryRunner.commitTransaction();
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'reorder', stage: body.stageIds.length };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Stage reorder failed: ${err instanceof Error ? err.message : String(err)}`);
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'reorder', stage: STAGE_RESPONSE_NOT_FOUND_ID };
    } finally {
      await queryRunner.release();
    }
  }
}
