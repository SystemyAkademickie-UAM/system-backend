import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import {
  GROUP_API_JSON_STATUS_OK,
  GROUP_RESPONSE_GROUP_ID_OFFSET,
  POST_ERROR_CODE_NOT_AUTHORIZED,
  POST_ERROR_CODE_NOT_CREATED,
} from '../constants/group-api-constants';
import { SCHEDULED_POST_PUBLISH_POLL_INTERVAL_MS } from '../constants/scheduled-post-constants';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { PostEntity } from '../database/entities/post.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { BacklogService } from '../backlog/backlog-service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

export type CreatePostResponseBody = { status: number; post: number };
export type GetPostsResponseBody = {
  status: number;
  posts: Array<{
    id: number;
    title: string;
    content: string;
    isPublished: boolean;
    createdAt: string | null;
    publishedAt: string | null;
    publishAt?: string | null;
  }>;
};
export type DeletePostResponseBody = { status: number; deleted: boolean };
export type UpdatePostResponseBody = { status: number; updated: boolean };

@Injectable()
export class GroupsPostsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GroupsPostsService.name);
  private intervalHandle?: NodeJS.Timeout;

  onModuleInit() {
    this.intervalHandle = setInterval(() => {
      this.publishScheduledPosts().catch((err) => {
        this.logger.error(`Publish scheduled posts error: ${String(err)}`);
      });
    }, SCHEDULED_POST_PUBLISH_POLL_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
  }

  async publishScheduledPosts(): Promise<void> {
    await this.postRepository
      .createQueryBuilder()
      .update(PostEntity)
      .set({ isPublished: true, publishedAt: () => 'NOW()', publishAt: null })
      .where('is_published = :isPub AND publish_at <= NOW()', { isPub: false })
      .execute();
  }

  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(PostEntity)
    private readonly postRepository: Repository<PostEntity>,
    private readonly backlogService: BacklogService) {}

  async createPost(
    req: Request,
    publicGroupId: number,
    body: CreatePostDto
  ): Promise<CreatePostResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
    if (!subject) {
      return { status: GROUP_API_JSON_STATUS_OK, post: POST_ERROR_CODE_NOT_AUTHORIZED }; // -1 = Not authorized
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
    if (lecturerAccountId === null) {
      return { status: GROUP_API_JSON_STATUS_OK, post: POST_ERROR_CODE_NOT_AUTHORIZED }; // -1 = Not authorized
    }

    const groupId =
      publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
        ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
        : publicGroupId;

    const ownsGroup = await this.groupRepository.exist({
      where: { id: groupId, teacherAccountId: lecturerAccountId },
    });
    if (!ownsGroup) {
      return { status: GROUP_API_JSON_STATUS_OK, post: POST_ERROR_CODE_NOT_AUTHORIZED }; // -1 = Not authorized
    }

    try {
      const createdAt = body.createdAt ? new Date(body.createdAt) : new Date();
      let isPublished = false;
      let publishedAt: Date | null = null;
      let publishAt: Date | null = null;

      if (body.publishAt) {
        const pAt = new Date(body.publishAt);
        if (pAt <= new Date()) {
          isPublished = true;
          publishedAt = new Date();
          publishAt = null;
        } else {
          isPublished = false;
          publishAt = pAt;
        }
      }

      const entity = this.postRepository.create({
        groupId,
        title: body.title,
        content: body.content,
        isPublished,
        createdAt,
        publishedAt,
        publishAt,
      });
      const saved = await this.postRepository.save(entity);
      if (isPublished) {
        await this.backlogService.notifyEnrolledStudents(groupId, 'POST_ADDED', {
          message: `Opublikowano nowy wpis: ${saved.title}.`,
          postId: saved.id,
          postTitle: saved.title,
        });
      }
      return { status: GROUP_API_JSON_STATUS_OK, post: saved.id };
    } catch (err: unknown) {
      this.logger.error(`Post creation failed: ${String(err)}`);
      return { status: GROUP_API_JSON_STATUS_OK, post: POST_ERROR_CODE_NOT_CREATED }; // -2 = Error / could not be created
    }
  }

  async getPosts(
    req: Request,
    publicGroupId: number,
    authParam?: string,
  ): Promise<GetPostsResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, authParam);
    if (!subject) {
      return { status: GROUP_API_JSON_STATUS_OK, posts: [] };
    }

    const groupId =
      publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
        ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
        : publicGroupId;

    let authorized = false;
    let ownsGroup = false;

    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
    if (lecturerAccountId !== null) {
      ownsGroup = await this.groupRepository.exist({
        where: { id: groupId, teacherAccountId: lecturerAccountId },
      });
      if (ownsGroup) {
        authorized = true;
      }
    }

    if (!authorized) {
      const studentAccountId = await this.userRolesService.findAccountIdForRole(
        subject.userId,
        STUDENT_ROLE_NAME);
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
      const whereClause = ownsGroup
        ? { groupId }
        : { groupId, isPublished: true };
      const posts = await this.postRepository.find({
        where: whereClause,
        order: { id: 'DESC' },
        select: ['id', 'title', 'content', 'isPublished', 'createdAt', 'publishedAt', 'publishAt'],
      });
      return {
        status: GROUP_API_JSON_STATUS_OK,
        posts: posts.map((p) => ({
          id: p.id,
          title: p.title ?? '',
          content: p.content ?? '',
          isPublished: p.isPublished,
          createdAt: p.createdAt ? p.createdAt.toISOString() : null,
          publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
          publishAt: p.publishAt ? p.publishAt.toISOString() : null,
        })),
      };
    } catch (err: unknown) {
      this.logger.error(`Get posts failed: ${String(err)}`);
      return { status: GROUP_API_JSON_STATUS_OK, posts: [] };
    }
  }

  async deletePost(
    req: Request,
    publicGroupId: number,
    postId: number,
    bodyAuth?: string,
  ): Promise<DeletePostResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, bodyAuth);
    if (!subject) {
      return { status: GROUP_API_JSON_STATUS_OK, deleted: false };
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
    if (lecturerAccountId === null) {
      return { status: GROUP_API_JSON_STATUS_OK, deleted: false };
    }

    const groupId =
      publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
        ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
        : publicGroupId;

    const ownsGroup = await this.groupRepository.exist({
      where: { id: groupId, teacherAccountId: lecturerAccountId },
    });
    if (!ownsGroup) {
      return { status: GROUP_API_JSON_STATUS_OK, deleted: false };
    }

    try {
      const result = await this.postRepository.delete({ id: postId, groupId });
      return {
        status: GROUP_API_JSON_STATUS_OK,
        deleted: (result.affected ?? 0) > 0,
      };
    } catch (err: unknown) {
      this.logger.error(`Delete post failed: ${String(err)}`);
      return { status: GROUP_API_JSON_STATUS_OK, deleted: false };
    }
  }

  async updatePost(
    req: Request,
    publicGroupId: number,
    postId: number,
    body: UpdatePostDto
  ): Promise<UpdatePostResponseBody> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, body.auth);
    if (!subject) {
      return { status: GROUP_API_JSON_STATUS_OK, updated: false };
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME);
    if (lecturerAccountId === null) {
      return { status: GROUP_API_JSON_STATUS_OK, updated: false };
    }

    const groupId =
      publicGroupId >= GROUP_RESPONSE_GROUP_ID_OFFSET
        ? publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET
        : publicGroupId;

    const ownsGroup = await this.groupRepository.exist({
      where: { id: groupId, teacherAccountId: lecturerAccountId },
    });
    if (!ownsGroup) {
      return { status: GROUP_API_JSON_STATUS_OK, updated: false };
    }

    try {
      const updateData: Partial<PostEntity> = {};
      if (body.title !== undefined) updateData.title = body.title;
      if (body.content !== undefined) updateData.content = body.content;
      if (body.isPublished !== undefined) {
        updateData.isPublished = body.isPublished;
        updateData.publishedAt = body.isPublished ? new Date() : null;
      }
      if (body.publishAt !== undefined) {
        if (body.publishAt === null) {
          updateData.publishAt = null;
        } else {
          const pAt = new Date(body.publishAt);
          if (pAt <= new Date()) {
            updateData.isPublished = true;
            updateData.publishedAt = new Date();
            updateData.publishAt = null;
          } else {
            updateData.isPublished = false;
            updateData.publishAt = pAt;
          }
        }
      }
      const result = await this.postRepository.update({ id: postId, groupId }, updateData);
      return {
        status: GROUP_API_JSON_STATUS_OK,
        updated: (result.affected ?? 0) > 0,
      };
    } catch (err: unknown) {
      this.logger.error(`Update post failed: ${String(err)}`);
      return { status: GROUP_API_JSON_STATUS_OK, updated: false };
    }
  }
}
