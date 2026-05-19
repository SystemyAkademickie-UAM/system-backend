import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
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
  status: number;
  method: StageMethod;
  stage: number;
  stages?: Array<{ id: number; groupId: number; name: string }>;
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
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(StageEntity)
    private readonly stageRepository: Repository<StageEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) {}

  async handleStage(
    req: Request,
    body: unknown,
    browserIdHeader: string | undefined,
  ): Promise<StageResponseBody> {
    const parsed = parseStageRequest(body);
    if (!parsed.ok) {
      return {
        status: STAGE_API_JSON_STATUS_BAD_REQUEST,
        method: parsed.method,
        stage: parsed.stage,
      };
    }
    const request = parsed.request;
    const method = request.method;
    if (method === 'post') {
      return this.createStage(req, request, browserIdHeader);
    }
    if (method === 'modify') {
      return this.modifyStage(req, request, browserIdHeader);
    }
    if (method === 'remove') {
      return this.removeStage(req, request, browserIdHeader);
    }
    return this.retrieveStages(req, request, browserIdHeader);
  }

  private async createStage(
    req: Request,
    body: ParsedStageRequest,
    browserIdHeader: string | undefined,
  ): Promise<StageResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      body.auth,
    );
    if (!subject) {
      return { status: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'post', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      return { status: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'post', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    if (!body.groupId || !body.name) {
      return { status: STAGE_API_JSON_STATUS_OK, method: 'post', stage: STAGE_RESPONSE_NOT_CREATED_ID };
    }
    const internalGroupId = toInternalGroupId(body.groupId);
    const groupExists = await this.groupRepository.exist({ where: { id: internalGroupId } });
    if (!groupExists) {
      return { status: STAGE_API_JSON_STATUS_OK, method: 'post', stage: STAGE_RESPONSE_NOT_CREATED_ID };
    }
    try {
      const entity = this.stageRepository.create({
        groupId: internalGroupId,
        name: body.name.trim(),
      });
      const saved = await this.stageRepository.save(entity);
      return { status: STAGE_API_JSON_STATUS_OK, method: 'post', stage: saved.id };
    } catch (err) {
      this.logger.error(`Stage creation failed: ${err instanceof Error ? err.message : String(err)}`);
      return { status: STAGE_API_JSON_STATUS_OK, method: 'post', stage: STAGE_RESPONSE_NOT_CREATED_ID };
    }
  }

  private async modifyStage(
    req: Request,
    body: ParsedStageRequest,
    browserIdHeader: string | undefined,
  ): Promise<StageResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, body.auth);
    if (!subject) {
      return { status: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'modify', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      return { status: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'modify', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    if (!body.stageId) {
      return { status: STAGE_API_JSON_STATUS_OK, method: 'modify', stage: STAGE_RESPONSE_NOT_FOUND_ID };
    }
    const existing = await this.stageRepository.findOne({ where: { id: body.stageId } });
    if (!existing) {
      return { status: STAGE_API_JSON_STATUS_OK, method: 'modify', stage: STAGE_RESPONSE_NOT_FOUND_ID };
    }
    try {
      if (body.name !== undefined) {
        existing.name = body.name.trim();
      }
      if (body.groupId !== undefined) {
        existing.groupId = toInternalGroupId(body.groupId);
      }
      await this.stageRepository.save(existing);
      return { status: STAGE_API_JSON_STATUS_OK, method: 'modify', stage: existing.id };
    } catch (err) {
      this.logger.error(`Stage modification failed: ${err instanceof Error ? err.message : String(err)}`);
      return { status: STAGE_API_JSON_STATUS_OK, method: 'modify', stage: STAGE_RESPONSE_NOT_FOUND_ID };
    }
  }

  private async removeStage(
    req: Request,
    body: ParsedStageRequest,
    browserIdHeader: string | undefined,
  ): Promise<StageResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, body.auth);
    if (!subject) {
      return { status: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'remove', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      return { status: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'remove', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    if (!body.stageId) {
      return { status: STAGE_API_JSON_STATUS_OK, method: 'remove', stage: STAGE_RESPONSE_NOT_FOUND_ID };
    }
    try {
      const result = await this.stageRepository.delete({ id: body.stageId });
      if (result.affected === 0) {
        return { status: STAGE_API_JSON_STATUS_OK, method: 'remove', stage: STAGE_RESPONSE_NOT_FOUND_ID };
      }
      return { status: STAGE_API_JSON_STATUS_OK, method: 'remove', stage: body.stageId };
    } catch (err) {
      this.logger.error(`Stage removal failed: ${err instanceof Error ? err.message : String(err)}`);
      return { status: STAGE_API_JSON_STATUS_OK, method: 'remove', stage: STAGE_RESPONSE_NOT_FOUND_ID };
    }
  }

  private async retrieveStages(
    req: Request,
    body: ParsedStageRequest,
    browserIdHeader: string | undefined,
  ): Promise<StageResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, body.auth);
    if (!subject) {
      return { status: STAGE_API_JSON_STATUS_FORBIDDEN, method: 'retrieve', stage: STAGE_RESPONSE_NOT_AUTHORIZED_ID };
    }
    try {
      let stages: StageEntity[];
      if (body.groupId) {
        const internalGroupId = toInternalGroupId(body.groupId);
        stages = await this.stageRepository.find({ where: { groupId: internalGroupId }, order: { id: 'ASC' } });
      } else if (body.stageId) {
        const single = await this.stageRepository.findOne({ where: { id: body.stageId } });
        stages = single ? [single] : [];
      } else {
        stages = await this.stageRepository.find({ order: { id: 'ASC' } });
      }
      return {
        status: STAGE_API_JSON_STATUS_OK,
        method: 'retrieve',
        stage: stages.length,
        stages: stages.map((s) => ({
          id: s.id,
          groupId: toPublicGroupId(s.groupId),
          name: s.name,
        })),
      };
    } catch (err) {
      this.logger.error(`Stage retrieval failed: ${err instanceof Error ? err.message : String(err)}`);
      return { status: STAGE_API_JSON_STATUS_OK, method: 'retrieve', stage: 0, stages: [] };
    }
  }
}
