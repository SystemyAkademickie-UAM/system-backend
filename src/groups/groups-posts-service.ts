import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import {
  GROUP_API_JSON_STATUS_OK,
  GROUP_RESPONSE_GROUP_ID_OFFSET,
} from '../constants/group-api-constants';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { PostEntity } from '../database/entities/post.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { CreatePostDto } from './dto/create-post.dto';

export type CreatePostResponseBody = { status: number; post: number };
export type GetPostsResponseBody = {
  status: number;
  posts: Array<{ id: number; title: string; content: string }>;
};

@Injectable()
export class GroupsPostsService {
  private readonly logger = new Logger(GroupsPostsService.name);

  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(PostEntity)
    private readonly postRepository: Repository<PostEntity>,
  ) {}

  async createPost(
    req: Request,
    publicGroupId: number,
    body: CreatePostDto,
    browserIdHeader: string | undefined,
  ): Promise<CreatePostResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      body.auth,
    );
    if (!subject) {
      return { status: GROUP_API_JSON_STATUS_OK, post: 1 }; // 1 = Not authorized
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME,
    );
    if (lecturerAccountId === null) {
      return { status: GROUP_API_JSON_STATUS_OK, post: 1 }; // 1 = Not authorized
    }

    const groupId =
      publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
        ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
        : publicGroupId;

    const ownsGroup = await this.groupRepository.exist({
      where: { id: groupId, teacherAccountId: lecturerAccountId },
    });
    if (!ownsGroup) {
      return { status: GROUP_API_JSON_STATUS_OK, post: 1 }; // 1 = Not authorized
    }

    try {
      const entity = this.postRepository.create({
        groupId,
        title: body.title,
        content: body.content,
      });
      const saved = await this.postRepository.save(entity);
      return { status: GROUP_API_JSON_STATUS_OK, post: saved.id };
    } catch (err: unknown) {
      this.logger.error(`Post creation failed: ${String(err)}`);
      return { status: GROUP_API_JSON_STATUS_OK, post: 0 }; // 0 = Error / could not be created
    }
  }

  async getPosts(
    req: Request,
    publicGroupId: number,
    browserIdHeader: string | undefined,
    authParam?: string,
  ): Promise<GetPostsResponseBody> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeader,
      authParam,
    );
    if (!subject) {
      return { status: GROUP_API_JSON_STATUS_OK, posts: [] };
    }

    const groupId =
      publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
        ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
        : publicGroupId;

    let authorized = false;

    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME,
    );
    if (lecturerAccountId !== null) {
      const ownsGroup = await this.groupRepository.exist({
        where: { id: groupId, teacherAccountId: lecturerAccountId },
      });
      if (ownsGroup) {
        authorized = true;
      }
    }

    if (!authorized) {
      const studentAccountId = await this.userRolesService.findAccountIdForRole(
        subject.userId,
        STUDENT_ROLE_NAME,
      );
      if (studentAccountId !== null) {
        const enrolled = await this.enrollmentRepository.exist({
          where: { groupId, studentAccountId },
        });
        if (enrolled) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return { status: GROUP_API_JSON_STATUS_OK, posts: [] };
    }

    try {
      const posts = await this.postRepository.find({
        where: { groupId },
        order: { id: 'DESC' },
        select: ['id', 'title', 'content'],
      });
      return {
        status: GROUP_API_JSON_STATUS_OK,
        posts: posts.map((p) => ({
          id: p.id,
          title: p.title ?? '',
          content: p.content ?? '',
        })),
      };
    } catch (err: unknown) {
      this.logger.error(`Get posts failed: ${String(err)}`);
      return { status: GROUP_API_JSON_STATUS_OK, posts: [] };
    }
  }
}
