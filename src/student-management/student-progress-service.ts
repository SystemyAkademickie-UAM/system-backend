import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { ActivityBacklogEntity } from '../database/entities/activity-backlog.entity';
import { ActivityEntity } from '../database/entities/activity.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { StageEntity } from '../database/entities/stage.entity';
import { RanksService } from '../gamification/ranks-service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { SetActivityCompletionsDto } from './dto/set-activity-completions.dto';
import { applyActivityCurrencyDelta } from './student-stats-reward.helper';

/** Single activity within a stage for the progress tree response. */
export interface ProgressActivityItem {
  id: number;
  name: string;
  currency: number;
  storyDescription: string;
  educationalDescription: string;
  isCompleted: boolean;
}

/** Single stage node in the progress tree response. */
export interface ProgressStageItem {
  id: number;
  name: string;
  activities: ProgressActivityItem[];
}

export type ActivityCompletionsResponse = {
  activityId: number;
  completedAccountIds: number[];
};

export type SetActivityCompletionsResponse = ActivityCompletionsResponse & {
  granted: number;
  revoked: number;
};

/**
 * Part 3 – Student progress tree, activity toggle, and bulk completions.
 */
@Injectable()
export class StudentProgressService {
  private readonly logger = new Logger(StudentProgressService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    private readonly ranksService: RanksService,
    private readonly dataSource: DataSource,
    @InjectRepository(StageEntity)
    private readonly stageRepository: Repository<StageEntity>,
    @InjectRepository(ActivityEntity)
    private readonly activityRepository: Repository<ActivityEntity>,
    @InjectRepository(ActivityBacklogEntity)
    private readonly activityBacklogRepository: Repository<ActivityBacklogEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>) {}

  /** GET /groups/:groupId/students/:accountId/progress */
  async getStudentProgress(
    req: Request,
    groupId: number,
    accountId: number): Promise<{ stages: ProgressStageItem[] }> {
    await this.assertLecturer(req);
    await this.assertGroupExists(groupId);
    await this.assertEnrollmentExists(groupId, accountId);
    const stages = await this.stageRepository.find({
      where: { groupId },
      order: { displayOrder: { direction: 'ASC', nulls: 'LAST' }, id: 'ASC' } as any,
    });
    const stageIds = stages.map((s) => s.id);
    const activities =
      stageIds.length > 0
        ? await this.activityRepository
            .createQueryBuilder('a')
            .where('a.stage_id IN (:...stageIds)', { stageIds })
            .orderBy('a.id', 'ASC')
            .getMany()
        : [];
    const completedEntries = await this.activityBacklogRepository.find({
      where: { groupId, accountId },
      select: ['activityId'],
    });
    const completedActivityIds = new Set(completedEntries.map((e) => e.activityId));
    const activitiesByStage = new Map<number, ActivityEntity[]>();
    for (const activity of activities) {
      const list = activitiesByStage.get(activity.stageId) ?? [];
      list.push(activity);
      activitiesByStage.set(activity.stageId, list);
    }
    const result: ProgressStageItem[] = stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      activities: (activitiesByStage.get(stage.id) ?? []).map((activity) => ({
        id: activity.id,
        name: activity.name,
        currency: activity.currency,
        storyDescription: activity.storyDescription,
        educationalDescription: activity.educationalDescription,
        isCompleted: completedActivityIds.has(activity.id),
      })),
    }));
    return { stages: result };
  }

  /** GET /groups/:groupId/activities/:activityId/completions */
  async getActivityCompletions(
    req: Request,
    groupId: number,
    activityId: number): Promise<ActivityCompletionsResponse> {
    await this.assertLecturer(req);
    await this.assertGroupExists(groupId);
    await this.findActivityInGroupOrFail(groupId, activityId);
    const rows = await this.activityBacklogRepository.find({
      where: { groupId, activityId },
      select: ['accountId'],
      order: { accountId: 'ASC' },
    });
    return {
      activityId,
      completedAccountIds: rows
        .map((row) => row.accountId)
        .filter((accountId): accountId is number => accountId !== null),
    };
  }

  /** PATCH /groups/:groupId/activities/:activityId/completions */
  async setActivityCompletions(
    req: Request,
    groupId: number,
    activityId: number,
    dto: SetActivityCompletionsDto): Promise<SetActivityCompletionsResponse> {
    await this.assertLecturer(req);
    await this.assertGroupExists(groupId);
    const activity = await this.findActivityInGroupOrFail(groupId, activityId);
    const targetAccountIds = [...new Set(dto.accountIds)];
    await this.assertEnrollmentsExist(groupId, targetAccountIds);
    const rewardAmount = activity.currency ?? 0;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const currentRows = await queryRunner.manager.find(ActivityBacklogEntity, {
        where: { groupId, activityId },
        select: ['accountId'],
      });
      const currentAccountIds = new Set(
        currentRows
          .map((row) => row.accountId)
          .filter((accountId): accountId is number => accountId !== null));
      const targetSet = new Set(targetAccountIds);
      const toGrant = targetAccountIds.filter((id) => !currentAccountIds.has(id));
      const toRevoke = [...currentAccountIds].filter((id) => !targetSet.has(id));
      let granted = 0;
      let revoked = 0;
      for (const accountId of toGrant) {
        await this.grantActivityCompletion(
          queryRunner,
          groupId,
          accountId,
          activityId,
          rewardAmount);
        granted += 1;
      }
      for (const accountId of toRevoke) {
        await this.revokeActivityCompletion(
          queryRunner,
          groupId,
          accountId,
          activityId,
          rewardAmount);
        revoked += 1;
      }
      await queryRunner.commitTransaction();
      this.logger.log(
        `Activity ${activityId} completions synced in group ${groupId}: granted=${granted}, revoked=${revoked}`);
      return {
        activityId,
        granted,
        revoked,
        completedAccountIds: targetAccountIds.sort((a, b) => a - b),
      };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Set activity completions failed (activity=${activityId}, group=${groupId}): ${String(err)}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** POST /groups/:groupId/students/:accountId/activities/:activityId/toggle */
  async toggleActivity(
    req: Request,
    groupId: number,
    accountId: number,
    activityId: number): Promise<{ isCompleted: boolean }> {
    await this.assertLecturer(req);
    await this.assertGroupExists(groupId);
    const enrollment = await this.findEnrollmentOrFail(groupId, accountId);
    const activity = await this.findActivityInGroupOrFail(groupId, activityId);
    const rewardAmount = activity.currency ?? 0;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const existing = await queryRunner.manager.findOne(ActivityBacklogEntity, {
        where: { groupId, accountId, activityId },
      });
      let isCompleted: boolean;
      if (existing) {
        await this.revokeActivityCompletion(
          queryRunner,
          groupId,
          accountId,
          activityId,
          rewardAmount);
        isCompleted = false;
        this.logger.log(`Activity ${activityId} uncompleted for account ${accountId} in group ${groupId}`);
      } else {
        await this.grantActivityCompletion(
          queryRunner,
          groupId,
          accountId,
          activityId,
          rewardAmount);
        isCompleted = true;
        this.logger.log(`Activity ${activityId} completed for account ${accountId} in group ${groupId}`);
      }
      await queryRunner.commitTransaction();
      return { isCompleted };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Toggle activity failed (activity=${activityId}, enrollment=${enrollment.id}): ${String(err)}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async grantActivityCompletion(
    queryRunner: QueryRunner,
    groupId: number,
    accountId: number,
    activityId: number,
    rewardAmount: number): Promise<void> {
    const enrollment = await this.findEnrollmentOrFail(groupId, accountId, queryRunner);
    const entry = queryRunner.manager.create(ActivityBacklogEntity, {
      groupId,
      accountId,
      activityId,
      date: new Date(),
    });
    await queryRunner.manager.save(ActivityBacklogEntity, entry);
    await applyActivityCurrencyDelta(
      queryRunner,
      this.ranksService,
      enrollment.id,
      groupId,
      rewardAmount);
  }

  private async revokeActivityCompletion(
    queryRunner: QueryRunner,
    groupId: number,
    accountId: number,
    activityId: number,
    rewardAmount: number): Promise<void> {
    const enrollment = await this.findEnrollmentOrFail(groupId, accountId, queryRunner);
    const existing = await queryRunner.manager.findOne(ActivityBacklogEntity, {
      where: { groupId, accountId, activityId },
    });
    if (!existing) {
      return;
    }
    await queryRunner.manager.remove(ActivityBacklogEntity, existing);
    await applyActivityCurrencyDelta(
      queryRunner,
      this.ranksService,
      enrollment.id,
      groupId,
      -rewardAmount);
  }

  private async findActivityInGroupOrFail(groupId: number, activityId: number): Promise<ActivityEntity> {
    const activity = await this.activityRepository
      .createQueryBuilder('activity')
      .innerJoin(StageEntity, 'stage', 'stage.id = activity.stage_id')
      .where('activity.id = :activityId', { activityId })
      .andWhere('stage.group_id = :groupId', { groupId })
      .getOne();
    if (!activity) {
      throw new NotFoundException(
        `Activity ${activityId} not found in group ${groupId}`);
    }
    return activity;
  }

  private async assertEnrollmentsExist(groupId: number, accountIds: number[]): Promise<void> {
    if (accountIds.length === 0) {
      return;
    }
    const enrollments = await this.enrollmentRepository.find({
      where: { groupId, studentAccountId: In(accountIds) },
      select: ['studentAccountId'],
    });
    const enrolledIds = new Set(enrollments.map((row) => row.studentAccountId));
    const missing = accountIds.filter((id) => !enrolledIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Account IDs not enrolled in group ${groupId}: ${missing.join(', ')}`);
    }
  }

  private async findEnrollmentOrFail(
    groupId: number,
    accountId: number,
    queryRunner?: QueryRunner): Promise<EnrollmentEntity> {
    const enrollment = queryRunner
      ? await queryRunner.manager.findOne(EnrollmentEntity, {
          where: { groupId, studentAccountId: accountId },
        })
      : await this.enrollmentRepository.findOne({
          where: { groupId, studentAccountId: accountId },
        });
    if (!enrollment) {
      throw new NotFoundException(
        `Student with accountId ${accountId} is not enrolled in group ${groupId}`);
    }
    return enrollment;
  }

  private async assertEnrollmentExists(groupId: number, accountId: number): Promise<void> {
    await this.findEnrollmentOrFail(groupId, accountId);
  }

  private async assertGroupExists(groupId: number): Promise<void> {
    const exists = await this.groupRepository.exist({ where: { id: groupId } });
    if (!exists) {
      throw new NotFoundException(`Group with id ${groupId} not found`);
    }
  }

  private async assertLecturer(req: Request): Promise<void> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }
  }
}
