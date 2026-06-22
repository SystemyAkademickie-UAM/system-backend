import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

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
import { StageEntity } from '../database/entities/stage.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { parseStageRequest, type ParsedStageRequest } from './stage-request-parser';

export type StageResponseBody = {
  statusCode: number;
  method: StageMethod;
  stage: number;
  stages?: Array<{ id: number; groupId: number; name: string; visibilityStatus: number }>;
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
    @InjectRepository(StageEntity)
    private readonly stageRepository: Repository<StageEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>) {}

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
      const entity = this.stageRepository.create({
        groupId: internalGroupId,
        name: body.name.trim(),
        visibilityStatus: body.visibilityStatus ?? 0, // Default to hidden (0) if not provided
      });
      const saved = await this.stageRepository.save(entity);
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'post', stage: saved.id };
    } catch (err) {
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
      if (body.name !== undefined) {
        existing.name = body.name.trim();
      }
      if (body.groupId !== undefined) {
        existing.groupId = toInternalGroupId(body.groupId);
      }
      if (body.visibilityStatus !== undefined) {
        existing.visibilityStatus = body.visibilityStatus;
      }
      await this.stageRepository.save(existing);
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'modify', stage: existing.id };
    } catch (err) {
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
    try {
      const result = await this.stageRepository.delete({ id: body.stageId });
      if (result.affected === 0) {
        return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'remove', stage: STAGE_RESPONSE_NOT_FOUND_ID };
      }
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'remove', stage: body.stageId };
    } catch (err) {
      this.logger.error(`Stage removal failed: ${err instanceof Error ? err.message : String(err)}`);
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'remove', stage: STAGE_RESPONSE_NOT_FOUND_ID };
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
    const filterHidden = !isLecturer;
    const visibilityCondition = filterHidden ? { visibilityStatus: 1 } : {};

    try {
      let stages: StageEntity[];
      if (body.groupId) {
        const internalGroupId = toInternalGroupId(body.groupId);
        stages = await this.stageRepository.find({ where: { groupId: internalGroupId, ...visibilityCondition }, order: { id: 'ASC' } });
      } else if (body.stageId) {
        const single = await this.stageRepository.findOne({ where: { id: body.stageId, ...visibilityCondition } });
        stages = single ? [single] : [];
      } else {
        stages = await this.stageRepository.find({ where: { ...visibilityCondition }, order: { id: 'ASC' } });
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
        })),
      };
    } catch (err) {
      this.logger.error(`Stage retrieval failed: ${err instanceof Error ? err.message : String(err)}`);
      return { statusCode: STAGE_API_JSON_STATUS_OK, method: 'retrieve', stage: 0, stages: [] };
    }
  }
}
