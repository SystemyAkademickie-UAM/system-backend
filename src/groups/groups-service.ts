import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import {
  GROUP_API_JSON_STATUS_OK,
  GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID,
  GROUP_RESPONSE_GROUP_NOT_CREATED_ID,
} from '../constants/group-api-constants';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { CreateGroupBodyDto } from './dto/create-group-body.dto';

export type CreateGroupResponseBody = { status: number; group: number };

/**
 * Persists groups for lecturers after session checks.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) {}

  async createGroup(
    body: CreateGroupBodyDto,
    browserIdHeader: string | undefined,
  ): Promise<CreateGroupResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectStrong(body.auth, browserIdHeader);
    if (!subject) {
      return { status: GROUP_API_JSON_STATUS_OK, group: GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID };
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      return { status: GROUP_API_JSON_STATUS_OK, group: GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID };
    }
    try {
      const groupEntity = this.groupRepository.create({
        name: body.group.name,
        description: body.group.description,
        currency: body.group.currency,
        currencyIcon: body.group.currencyIcon,
        life: body.group.life,
        lifeIcon: body.group.lifeIcon,
        bannerRef: body.group.bannerRef ?? null,
        createdByUserId: subject.userId,
      });
      const saved = await this.groupRepository.save(groupEntity);
      return { status: GROUP_API_JSON_STATUS_OK, group: saved.id };
    } catch {
      return { status: GROUP_API_JSON_STATUS_OK, group: GROUP_RESPONSE_GROUP_NOT_CREATED_ID };
    }
  }
}
