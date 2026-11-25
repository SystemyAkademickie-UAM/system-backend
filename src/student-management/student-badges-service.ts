import { ForbiddenException, Injectable, Logger, NotFoundException, Optional, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';

import { SessionService, type SessionSubject } from '../auth/session/session.service';
import { STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { BadgeEntity } from '../database/entities/badge.entity';
import { EarnedBadgeEntity } from '../database/entities/earned-badge.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { RankEntity } from '../database/entities/rank.entity';
import { RanksService } from '../gamification/ranks-service';
import { ORGANIZATION_LOG_KIND_BADGE_REVOKED } from '../constants/organization-log-constants';
import { OrganizationLogService } from '../organization-log/organization-log.service';
import type { BacklogPayload } from '../backlog/backlog-payload';
import { BacklogService } from '../backlog/backlog-service';
import { GroupAuthorizationService } from '../groups/group-authorization.service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { applyBadgeGrantDelta, applyBadgeRevokeDelta } from './student-stats-reward.helper';
import { toVisibleBadge } from '../gamification/to-visible-badge';

/**
 * Badge item returned to the frontend with an `isEarned` flag.
 * For an unrevealed secret badge (`isSecret && !isRevealed`) the detail fields are `null`
 * while `rarity` stays visible so the client can show the badge colour.
 */
export interface StudentBadgeItem {
  id: number;
  name: string | null;
  icon: string | null;
  rarity: string;
  educationalDescription: string | null;
  storyDescription: string | null;
  rewardAmount: number | null;
  isSecret: boolean;
  isRevealed: boolean;
  isEarned: boolean;
}

/** Who reads the badge list: the group owner or an enrolled student (with their enrollment). */
type StudentBadgesViewer = {
  isOwner: boolean;
  viewerEnrollmentId: number | null;
};

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
    private readonly backlogService: BacklogService,
    private readonly dataSource: DataSource,
    @InjectRepository(BadgeEntity)
    private readonly badgeRepository: Repository<BadgeEntity>,
    @InjectRepository(EarnedBadgeEntity)
    private readonly earnedBadgeRepository: Repository<EarnedBadgeEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    private readonly groupAuthorizationService: GroupAuthorizationService,
    @Optional() private readonly organizationLogService?: OrganizationLogService) {}

  /**
   * GET /groups/:groupId/students/:accountId/badges
   *
   * Secret badges are revealed to the group owner and to a viewer who earned them;
   * other viewers only learn that the badge exists (and whether the target student earned it).
   */
  async getStudentBadges(req: Request, groupId: number, accountId: number): Promise<{ badges: StudentBadgeItem[] }> {
    const viewer = await this.resolveStudentBadgesViewer(req, groupId);
    const enrollment = await this.findEnrollmentOrFail(groupId, accountId);
    const badges = await this.badgeRepository.find({
      where: viewer.isOwner ? { groupId } : { groupId, isPublished: true },
      order: { id: 'ASC' },
    });
    const earnedBadgeIds = await this.findEarnedBadgeIds(enrollment.id);
    const viewerEarnedBadgeIds = await this.findViewerEarnedBadgeIds({
      viewer,
      targetEnrollmentId: enrollment.id,
      targetEarnedBadgeIds: earnedBadgeIds,
    });
    const result: StudentBadgeItem[] = badges.map((badge) => this.toStudentBadgeItem({
      badge,
      isEarned: earnedBadgeIds.has(badge.id),
      canSeeSecret: viewer.isOwner || viewerEarnedBadgeIds.has(badge.id),
    }));
    return { badges: result };
  }

  /** POST /groups/:groupId/students/:accountId/badges/:badgeId/toggle */
  async toggleBadge(
    req: Request,
    groupId: number,
    accountId: number,
    badgeId: number): Promise<{ isEarned: boolean }> {
    await this.groupAuthorizationService.assertLecturerOwnsGroupFromRequest(req, groupId);
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
        await this.organizationLogService?.recordForGroup({
          groupId,
          kind: ORGANIZATION_LOG_KIND_BADGE_REVOKED,
          actorAccountId: accountId,
          detail: { badgeName: badge.name },
          manager: queryRunner.manager,
        });
        this.logger.log(`Badge ${badgeId} revoked from enrollment ${enrollment.id}`);
      } else {
        const earned = queryRunner.manager.create(EarnedBadgeEntity, {
          enrollmentId: enrollment.id,
          badgeId,
        });
        await queryRunner.manager.save(EarnedBadgeEntity, earned);
        const rankChange = await applyBadgeGrantDelta(
          queryRunner,
          this.ranksService,
          enrollment.id,
          groupId,
          rewardAmount);
        await this.backlogService.logEvent(
          groupId,
          accountId,
          'BADGE_EARNED',
          this.buildBadgeEarnedPayload(badge, rewardAmount),
          queryRunner.manager);
        if (
          rankChange.previousRankId !== rankChange.newRankId
          && rankChange.newRankId != null
        ) {
          const newRank = await queryRunner.manager.findOne(RankEntity, { where: { id: rankChange.newRankId } });
          await this.backlogService.logEvent(groupId, accountId, 'RANK_UP', {
            message: newRank ? `Otrzymano wyższą rangę: ${newRank.name}.` : 'Otrzymano wyższą rangę.',
            rankId: rankChange.newRankId,
            rankName: newRank?.name,
            previousRankId: rankChange.previousRankId,
          }, queryRunner.manager);
        }
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

  private buildBadgeEarnedPayload(badge: BadgeEntity, rewardAmount: number): BacklogPayload {
    if (badge.isSecret) {
      return {
        message: `Otrzymano sekretną odznakę: ${badge.name}.`,
        badgeId: badge.id,
        badgeName: badge.name,
        rewardAmount,
        isSecret: true,
      };
    }
    return {
      message: `Otrzymano odznakę: ${badge.name}.`,
      badgeId: badge.id,
      badgeName: badge.name,
      rewardAmount,
    };
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

  private async findEarnedBadgeIds(enrollmentId: number): Promise<ReadonlySet<number>> {
    const earnedRows = await this.earnedBadgeRepository.find({ where: { enrollmentId } });
    return new Set(earnedRows.map((row) => row.badgeId).filter((badgeId): badgeId is number => badgeId !== null));
  }

  /** Earned badge ids of the viewer; reuses the target set when a student views their own list. */
  private async findViewerEarnedBadgeIds(input: {
    viewer: StudentBadgesViewer;
    targetEnrollmentId: number;
    targetEarnedBadgeIds: ReadonlySet<number>;
  }): Promise<ReadonlySet<number>> {
    const { viewer, targetEnrollmentId, targetEarnedBadgeIds } = input;
    if (viewer.viewerEnrollmentId === null) {
      return new Set<number>();
    }
    if (viewer.viewerEnrollmentId === targetEnrollmentId) {
      return targetEarnedBadgeIds;
    }
    return this.findEarnedBadgeIds(viewer.viewerEnrollmentId);
  }

  private toStudentBadgeItem(input: {
    badge: BadgeEntity;
    isEarned: boolean;
    canSeeSecret: boolean;
  }): StudentBadgeItem {
    const visible = toVisibleBadge({ badge: input.badge, canSeeSecret: input.canSeeSecret });
    return {
      id: visible.id,
      name: visible.name,
      icon: visible.icon,
      rarity: visible.rarity,
      educationalDescription: visible.educationalDescription,
      storyDescription: visible.storyDescription,
      rewardAmount: visible.rewardAmount,
      isSecret: visible.isSecret,
      isRevealed: visible.isRevealed,
      isEarned: input.isEarned,
    };
  }

  /**
   * Allows the group owner or a student enrolled in the group; returns the viewer context.
   */
  private async resolveStudentBadgesViewer(req: Request, groupId: number): Promise<StudentBadgesViewer> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      throw new UnauthorizedException('Not authorized');
    }
    const isOwner = await this.groupAuthorizationService.isLecturerOwner(
      subject.userId,
      groupId,
      subject.organizationId);
    if (isOwner) {
      return { isOwner: true, viewerEnrollmentId: null };
    }
    const studentAccountId = await this.findStudentAccountId(subject);
    if (studentAccountId !== null) {
      const viewerEnrollment = await this.enrollmentRepository.findOne({ where: { groupId, studentAccountId } });
      if (viewerEnrollment) {
        return { isOwner: false, viewerEnrollmentId: viewerEnrollment.id };
      }
    }
    throw new ForbiddenException('Not authorized to access badges in this group');
  }

  private findStudentAccountId(subject: SessionSubject): Promise<number | null> {
    if (subject.organizationId != null) {
      return this.userRolesService.findAccountIdForRoleInOrganization(
        subject.userId,
        subject.organizationId,
        STUDENT_ROLE_NAME);
    }
    return this.userRolesService.findAccountIdForRole(subject.userId, STUDENT_ROLE_NAME);
  }
}
