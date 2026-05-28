import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import type { Request } from 'express';

import { DataSource, Repository } from 'typeorm';



import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';

import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';

import { ActivityBacklogEntity } from '../database/entities/activity-backlog.entity';

import { ActivityEntity } from '../database/entities/activity.entity';

import { EnrollmentEntity } from '../database/entities/enrollment.entity';

import { StageEntity } from '../database/entities/stage.entity';

import { StudentStatsEntity } from '../database/entities/student-stats.entity';

import { UserRolesService } from '../user-roles/user-roles-service';
import { RanksService } from '../gamification/ranks-service';



/**

 * Single activity within a stage for the progress tree response.

 */

export interface ProgressActivityItem {

  id: number;

  name: string;

  currency: number;

  storyDescription: string;

  educationalDescription: string;

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

        storyDescription: activity.storyDescription,

        educationalDescription: activity.educationalDescription,

        isCompleted: completedActivityIds.has(activity.id),

      })),

    }));



    return { stages: result };

  }



  /**

   * POST /groups/:groupId/students/:accountId/activities/:activityId/toggle

   * Creates or removes an `activity_backlog` entry and adjusts student currency.

   */

  async toggleActivity(

    req: Request,

    groupId: number,

    accountId: number,

    activityId: number,

  ): Promise<{ isCompleted: boolean }> {

    await this.assertLecturer(req);



    const enrollment = await this.findEnrollmentOrFail(groupId, accountId);



    const activity = await this.activityRepository.findOne({ where: { id: activityId } });

    if (!activity) {

      throw new NotFoundException(`Activity ${activityId} not found`);

    }



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

        await queryRunner.manager.remove(ActivityBacklogEntity, existing);

        await this.adjustStudentStats(queryRunner, enrollment.id, groupId, -rewardAmount);

        isCompleted = false;

        this.logger.log(`Activity ${activityId} uncompleted for account ${accountId} in group ${groupId}`);

      } else {

        const entry = queryRunner.manager.create(ActivityBacklogEntity, {

          groupId,

          accountId,

          activityId,

          date: new Date(),

        });

        await queryRunner.manager.save(ActivityBacklogEntity, entry);

        await this.adjustStudentStats(queryRunner, enrollment.id, groupId, rewardAmount);

        isCompleted = true;

        this.logger.log(`Activity ${activityId} completed for account ${accountId} in group ${groupId}`);

      }



      await queryRunner.commitTransaction();

      return { isCompleted };

    } catch (err: unknown) {

      await queryRunner.rollbackTransaction();

      this.logger.error(

        `Toggle activity failed (activity=${activityId}, enrollment=${enrollment.id}): ${String(err)}`,

      );

      throw err;

    } finally {

      await queryRunner.release();

    }

  }



  // ── Helpers ─────────────────────────────────────────────────────────



  private async adjustStudentStats(
    queryRunner: import('typeorm').QueryRunner,
    enrollmentId: number,
    groupId: number,
    delta: number,
  ): Promise<void> {
    if (delta === 0) return;

    let stats = await queryRunner.manager.findOne(StudentStatsEntity, {
      where: { enrollmentId },
    });

    if (!stats) {
      const initialRankId = await this.ranksService.calculateRankForPoints(groupId, 0);
      stats = queryRunner.manager.create(StudentStatsEntity, {
        enrollmentId,
        currency: 0,
        totalEarned: 0,
        rankId: initialRankId,
      });
    }

    stats.currency = Math.max(0, (stats.currency ?? 0) + delta);
    stats.totalEarned = Math.max(0, (stats.totalEarned ?? 0) + delta);
    stats.rankId = await this.ranksService.calculateRankForPoints(groupId, stats.totalEarned);

    await queryRunner.manager.save(StudentStatsEntity, stats);
  }



  private async findEnrollmentOrFail(groupId: number, accountId: number): Promise<EnrollmentEntity> {

    const enrollment = await this.enrollmentRepository.findOne({

      where: { groupId, studentAccountId: accountId },

    });

    if (!enrollment) {

      throw new NotFoundException(

        `Student with accountId ${accountId} is not enrolled in group ${groupId}`,

      );

    }

    return enrollment;

  }



  private async assertEnrollmentExists(groupId: number, accountId: number): Promise<void> {

    await this.findEnrollmentOrFail(groupId, accountId);

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


