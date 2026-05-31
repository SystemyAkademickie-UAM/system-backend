import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import {
  ACTIVITY_API_JSON_STATUS_BAD_REQUEST,
  ACTIVITY_API_JSON_STATUS_FORBIDDEN,
  ACTIVITY_API_JSON_STATUS_OK,
  ACTIVITY_RESPONSE_NOT_AUTHORIZED_ID,
  ACTIVITY_RESPONSE_NOT_CREATED_ID,
  ACTIVITY_RESPONSE_NOT_FOUND_ID,
  ACTIVITY_RESPONSE_STAGE_NOT_FOUND_ID,
  type ActivityMethod,
} from '../constants/activity-api-constants';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { ActivityBacklogEntity } from '../database/entities/activity-backlog.entity';
import { ActivityEntity } from '../database/entities/activity.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { StageEntity } from '../database/entities/stage.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { parseActivityRequest, type ParsedActivityRequest } from './activity-request-parser';

export type ActivityResponseBody = {
  statusCode: number;
  method: ActivityMethod;
  activity: number;
  activities?: Array<{
    id: number;
    stageId: number;
    name: string;
    currency: number;
    educationalDescription: string;
    storyDescription: string;
  }>;
};

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(ActivityEntity)
    private readonly activityRepository: Repository<ActivityEntity>,
    @InjectRepository(StageEntity)
    private readonly stageRepository: Repository<StageEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(ActivityBacklogEntity)
    private readonly activityBacklogRepository: Repository<ActivityBacklogEntity>,
  ) {}

  async handleActivity(
    req: Request,
    body: unknown,
    browserIdHeader: string | undefined,
  ): Promise<ActivityResponseBody> {
    const parsed = parseActivityRequest(body);
    if (!parsed.ok) {
      return {
        statusCode: ACTIVITY_API_JSON_STATUS_BAD_REQUEST,
        method: parsed.method,
        activity: parsed.activity,
      };
    }
    const request = parsed.request;
    const method = request.method;
    if (method === 'post') {
      return this.createActivity(req, request, browserIdHeader);
    }
    if (method === 'modify') {
      return this.modifyActivity(req, request, browserIdHeader);
    }
    if (method === 'remove') {
      return this.removeActivity(req, request, browserIdHeader);
    }
    return this.retrieveActivities(req, request, browserIdHeader);
  }

  private async createActivity(
    req: Request,
    body: ParsedActivityRequest,
    browserIdHeader: string | undefined,
  ): Promise<ActivityResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      body.auth,
    );
    if (!subject) {
      return { statusCode: ACTIVITY_API_JSON_STATUS_FORBIDDEN, method: 'post', activity: ACTIVITY_RESPONSE_NOT_AUTHORIZED_ID };
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      return { statusCode: ACTIVITY_API_JSON_STATUS_FORBIDDEN, method: 'post', activity: ACTIVITY_RESPONSE_NOT_AUTHORIZED_ID };
    }
    if (!body.stageId || !body.name || body.currency === undefined) {
      return { statusCode: ACTIVITY_API_JSON_STATUS_OK, method: 'post', activity: ACTIVITY_RESPONSE_NOT_CREATED_ID };
    }
    const stageExists = await this.stageRepository.exist({ where: { id: body.stageId } });
    if (!stageExists) {
      return { statusCode: ACTIVITY_API_JSON_STATUS_OK, method: 'post', activity: ACTIVITY_RESPONSE_STAGE_NOT_FOUND_ID };
    }
    try {
      const entity = this.activityRepository.create({
        stageId: body.stageId,
        name: body.name.trim(),
        currency: body.currency,
        educationalDescription: body.educationalDescription?.trim() ?? '',
        storyDescription: body.storyDescription?.trim() ?? '',
      });
      const saved = await this.activityRepository.save(entity);
      return { statusCode: ACTIVITY_API_JSON_STATUS_OK, method: 'post', activity: saved.id };
    } catch (err) {
      this.logger.error(`Activity creation failed: ${err instanceof Error ? err.message : String(err)}`);
      return { statusCode: ACTIVITY_API_JSON_STATUS_OK, method: 'post', activity: ACTIVITY_RESPONSE_NOT_CREATED_ID };
    }
  }

  private async modifyActivity(
    req: Request,
    body: ParsedActivityRequest,
    browserIdHeader: string | undefined,
  ): Promise<ActivityResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, body.auth);
    if (!subject) {
      return { statusCode: ACTIVITY_API_JSON_STATUS_FORBIDDEN, method: 'modify', activity: ACTIVITY_RESPONSE_NOT_AUTHORIZED_ID };
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      return { statusCode: ACTIVITY_API_JSON_STATUS_FORBIDDEN, method: 'modify', activity: ACTIVITY_RESPONSE_NOT_AUTHORIZED_ID };
    }
    if (!body.activityId) {
      return { statusCode: ACTIVITY_API_JSON_STATUS_OK, method: 'modify', activity: ACTIVITY_RESPONSE_NOT_FOUND_ID };
    }
    const existing = await this.activityRepository.findOne({ where: { id: body.activityId } });
    if (!existing) {
      return { statusCode: ACTIVITY_API_JSON_STATUS_OK, method: 'modify', activity: ACTIVITY_RESPONSE_NOT_FOUND_ID };
    }
    try {
      if (body.name !== undefined) {
        existing.name = body.name.trim();
      }
      if (body.stageId !== undefined) {
        existing.stageId = body.stageId;
      }
      if (body.currency !== undefined) {
        existing.currency = body.currency;
      }
      if (body.educationalDescription !== undefined) {
        existing.educationalDescription = body.educationalDescription.trim();
      }
      if (body.storyDescription !== undefined) {
        existing.storyDescription = body.storyDescription.trim();
      }
      await this.activityRepository.save(existing);
      return { statusCode: ACTIVITY_API_JSON_STATUS_OK, method: 'modify', activity: existing.id };
    } catch (err) {
      this.logger.error(`Activity modification failed: ${err instanceof Error ? err.message : String(err)}`);
      return { statusCode: ACTIVITY_API_JSON_STATUS_OK, method: 'modify', activity: ACTIVITY_RESPONSE_NOT_FOUND_ID };
    }
  }

  private async removeActivity(
    req: Request,
    body: ParsedActivityRequest,
    browserIdHeader: string | undefined,
  ): Promise<ActivityResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, body.auth);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }
    if (!body.activityId) {
      throw new NotFoundException('Activity not found');
    }
    const activity = await this.activityRepository.findOne({ where: { id: body.activityId } });
    if (!activity) {
      throw new NotFoundException(`Activity ${body.activityId} not found`);
    }
    const stage = await this.stageRepository.findOne({ where: { id: activity.stageId } });
    if (!stage) {
      throw new NotFoundException(`Activity ${body.activityId} not found`);
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME,
    );
    if (lecturerAccountId === null) {
      throw new ForbiddenException('Not authorized');
    }
    const group = await this.groupRepository.findOne({ where: { id: stage.groupId } });
    if (!group || group.teacherAccountId !== lecturerAccountId) {
      throw new ForbiddenException('Not authorized for this activity');
    }
    await this.activityBacklogRepository.delete({ activityId: body.activityId });
    const result = await this.activityRepository.delete({ id: body.activityId });
    if (result.affected === 0) {
      throw new NotFoundException(`Activity ${body.activityId} not found`);
    }
    return { statusCode: ACTIVITY_API_JSON_STATUS_OK, method: 'remove', activity: body.activityId };
  }

  private async retrieveActivities(
    req: Request,
    body: ParsedActivityRequest,
    browserIdHeader: string | undefined,
  ): Promise<ActivityResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, body.auth);
    if (!subject) {
      return { statusCode: ACTIVITY_API_JSON_STATUS_FORBIDDEN, method: 'retrieve', activity: ACTIVITY_RESPONSE_NOT_AUTHORIZED_ID };
    }
    try {
      let activities: ActivityEntity[];
      if (body.stageId) {
        activities = await this.activityRepository.find({ where: { stageId: body.stageId }, order: { id: 'ASC' } });
      } else if (body.activityId) {
        const single = await this.activityRepository.findOne({ where: { id: body.activityId } });
        activities = single ? [single] : [];
      } else {
        activities = await this.activityRepository.find({ order: { id: 'ASC' } });
      }
      return {
        statusCode: ACTIVITY_API_JSON_STATUS_OK,
        method: 'retrieve',
        activity: activities.length,
        activities: activities.map((a) => ({
          id: a.id,
          stageId: a.stageId,
          name: a.name,
          currency: a.currency,
          educationalDescription: a.educationalDescription,
          storyDescription: a.storyDescription,
        })),
      };
    } catch (err) {
      this.logger.error(`Activity retrieval failed: ${err instanceof Error ? err.message : String(err)}`);
      return { statusCode: ACTIVITY_API_JSON_STATUS_OK, method: 'retrieve', activity: 0, activities: [] };
    }
  }
}
