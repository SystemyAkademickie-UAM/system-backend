import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { BadgeEntity } from '../database/entities/badge.entity';
import { EarnedBadgeEntity } from '../database/entities/earned-badge.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { RanksService } from '../gamification/ranks-service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { applyBadgeGrantDelta, applyBadgeRevokeDelta } from './student-stats-reward.helper';

/** Badge item returned to the frontend with an `isEarned` flag. */
export interface StudentBadgeItem {
  id: number;
  name: string;
  icon: string | null;
  educationalDescription: string | null;
  storyDescription: string | null;
  rewardAmount: number | null;
  isEarned: boolean;
}

/**
 * Part 2 – Badge listing & toggle for a specific student in a group.
 */
@Injectable()
export class StudentBadgesService {
  private readonly logger = new Logger(StudentBadgesService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    private readonly ranksService: RanksService,
    private readonly dataSource: DataSource,
    @InjectRepository(BadgeEntity)
    private readonly badgeRepository: Repository<BadgeEntity>,
    @InjectRepository(EarnedBadgeEntity)
    private readonly earnedBadgeRepository: Repository<EarnedBadgeEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>) {}

  /** GET /groups/:groupId/students/:accountId/badges */
  async getStudentBadges(req: Request, groupId: number, accountId: number): Promise<{ badges: StudentBadgeItem[] }> {
    await this.assertLecturer(req);
    const enrollment = await this.findEnrollmentOrFail(groupId, accountId);
    const badges = await this.badgeRepository.find({ where: { groupId } });
    const earnedBadges = await this.earnedBadgeRepository.find({
      where: { enrollmentId: enrollment.id },
    });
    const earnedBadgeIds = new Set(earnedBadges.map((eb) => eb.badgeId));
    const result: StudentBadgeItem[] = badges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      icon: badge.icon,
      educationalDescription: badge.educationalDescription,
      storyDescription: badge.storyDescription,
      rewardAmount: badge.rewardAmount,
      isEarned: earnedBadgeIds.has(badge.id),
    }));
    return { badges: result };
  }

  /** POST /groups/:groupId/students/:accountId/badges/:badgeId/toggle */
  async toggleBadge(
    req: Request,
    groupId: number,
    accountId: number,
    badgeId: number): Promise<{ isEarned: boolean }> {
    await this.assertLecturer(req);
    const enrollment = await this.findEnrollmentOrFail(groupId, accountId);
    const badge = await this.badgeRepository.findOne({ where: { id: badgeId, groupId } });
    if (!badge) {
      throw new NotFoundException(`Badge ${badgeId} not found in group ${groupId}`);
    }
    const rewardAmount = badge.rewardAmount ?? 0;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const existing = await queryRunner.manager.findOne(EarnedBadgeEntity, {
        where: { enrollmentId: enrollment.id, badgeId },
      });
      let isEarned: boolean;
      if (existing) {
        await queryRunner.manager.remove(EarnedBadgeEntity, existing);
        await applyBadgeRevokeDelta(
          queryRunner,
          this.ranksService,
          enrollment.id,
          groupId,
          rewardAmount);
        isEarned = false;
        this.logger.log(`Badge ${badgeId} revoked from enrollment ${enrollment.id}`);
      } else {
        const earned = queryRunner.manager.create(EarnedBadgeEntity, {
          enrollmentId: enrollment.id,
          badgeId,
        });
        await queryRunner.manager.save(EarnedBadgeEntity, earned);
        await applyBadgeGrantDelta(
          queryRunner,
          this.ranksService,
          enrollment.id,
          groupId,
          rewardAmount);
        isEarned = true;
        this.logger.log(`Badge ${badgeId} granted to enrollment ${enrollment.id}`);
      }
      await queryRunner.commitTransaction();
      return { isEarned };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Toggle badge failed (badge=${badgeId}, enrollment=${enrollment.id}): ${String(err)}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async findEnrollmentOrFail(groupId: number, accountId: number): Promise<EnrollmentEntity> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { groupId, studentAccountId: accountId },
    });
    if (!enrollment) {
      throw new NotFoundException(
        `Student with accountId ${accountId} is not enrolled in group ${groupId}`);
    }
    return enrollment;
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
