import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { ActivityBacklogEntity } from '../database/entities/activity-backlog.entity';
import { ActivityEntity } from '../database/entities/activity.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { StageEntity } from '../database/entities/stage.entity';
import { UserRolesService } from '../user-roles/user-roles-service';

/**
 * Single activity within a stage for the progress tree response.
 */
export interface ProgressActivityItem {
  id: number;
  name: string;
  currency: number;
  isCompleted: boolean;
}

/**
 * Single stage node in the progress tree response.
 */
export interface ProgressStageItem {
  id: number;
  name: string;
  activities: ProgressActivityItem[];
}

/**
 * Part 3 – Student progress tree & activity toggle.
 */
@Injectable()
export class StudentProgressService {
  private readonly logger = new Logger(StudentProgressService.name);

  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(StageEntity)
    private readonly stageRepository: Repository<StageEntity>,
    @InjectRepository(ActivityEntity)
    private readonly activityRepository: Repository<ActivityEntity>,
    @InjectRepository(ActivityBacklogEntity)
    private readonly activityBacklogRepository: Repository<ActivityBacklogEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
  ) {}

  /**
   * GET /groups/:groupId/students/:accountId/progress
   * Builds a tree: stages → activities with `isCompleted` flag.
   */
  async getStudentProgress(
    req: Request,
    groupId: number,
    accountId: number,
  ): Promise<{ stages: ProgressStageItem[] }> {
    await this.assertLecturer(req);
    await this.assertEnrollmentExists(groupId, accountId);

    const stages = await this.stageRepository.find({
      where: { groupId },
      order: { id: 'ASC' },
    });

    // Fetch all activities for the group's stages in one query
    const stageIds = stages.map((s) => s.id);
    const activities =
      stageIds.length > 0
        ? await this.activityRepository
            .createQueryBuilder('a')
            .where('a.stage_id IN (:...stageIds)', { stageIds })
            .orderBy('a.id', 'ASC')
            .getMany()
        : [];

    // Fetch all completed activity IDs for this student in this group
    const completedEntries = await this.activityBacklogRepository.find({
      where: { groupId, accountId },
      select: ['activityId'],
    });
    const completedActivityIds = new Set(completedEntries.map((e) => e.activityId));

    // Group activities by stageId
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
        isCompleted: completedActivityIds.has(activity.id),
      })),
    }));

    return { stages: result };
  }

  /**
   * POST /groups/:groupId/students/:accountId/activities/:activityId/toggle
   * Creates or removes an `activity_backlog` entry.
   */
  async toggleActivity(
    req: Request,
    groupId: number,
    accountId: number,
    activityId: number,
  ): Promise<{ isCompleted: boolean }> {
    await this.assertLecturer(req);
    await this.assertEnrollmentExists(groupId, accountId);

    const activity = await this.activityRepository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new NotFoundException(`Activity ${activityId} not found`);
    }

    const existing = await this.activityBacklogRepository.findOne({
      where: { groupId, accountId, activityId },
    });

    if (existing) {
      await this.activityBacklogRepository.remove(existing);
      this.logger.log(`Activity ${activityId} uncompleted for account ${accountId} in group ${groupId}`);
      return { isCompleted: false };
    }

    const entry = this.activityBacklogRepository.create({
      groupId,
      accountId,
      activityId,
      date: new Date(),
    });
    await this.activityBacklogRepository.save(entry);
    this.logger.log(`Activity ${activityId} completed for account ${accountId} in group ${groupId}`);
    return { isCompleted: true };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private async assertEnrollmentExists(groupId: number, accountId: number): Promise<void> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { groupId, studentAccountId: accountId },
    });
    if (!enrollment) {
      throw new NotFoundException(
        `Student with accountId ${accountId} is not enrolled in group ${groupId}`,
      );
    }
  }

  private async assertLecturer(req: Request): Promise<void> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }
  }
}
