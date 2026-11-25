import { ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';

import { SessionService, type SessionSubject } from '../auth/session/session.service';
import { STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { BadgeEntity, BadgeRarity } from '../database/entities/badge.entity';
import { EarnedBadgeEntity } from '../database/entities/earned-badge.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { GroupAuthorizationService } from '../groups/group-authorization.service';
import type { BacklogPayload } from '../backlog/backlog-payload';
import { BacklogService } from '../backlog/backlog-service';
import { RanksService } from './ranks-service';
import { applyBadgeRevokeDelta } from '../student-management/student-stats-reward.helper';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { UpdateBadgeDto } from './dto/update-badge.dto';
import { toVisibleBadge } from './to-visible-badge';
import type { VisibleBadge } from './visible-badge.type';

export type DeleteBadgeResponse = {
  deleted: boolean;
  revokedFromStudents: number;
};

/**
 * Persists badge definitions in `gamification.badges` for a given course group.
 */
@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

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
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    private readonly groupAuthorizationService: GroupAuthorizationService) {}

  /**
   * Lists badges of a group. Group owners see every badge with full details;
   * enrolled students see published badges only, and secret badges stay masked
   * until the caller has earned them.
   */
  async getBadgesForGroup(req: Request, groupId: number, queryAuth?: string): Promise<VisibleBadge[]> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, queryAuth);
    if (!subject) {
      throw new UnauthorizedException('Not authorized');
    }
    await this.assertGroupExists(groupId);
    const isOwner = await this.groupAuthorizationService.isLecturerOwner(
      subject.userId,
      groupId,
      subject.organizationId);
    if (isOwner) {
      const allBadges = await this.badgeRepository.find({ where: { groupId }, order: { id: 'ASC' } });
      return allBadges.map((badge) => toVisibleBadge({ badge, canSeeSecret: true }));
    }
    const enrollment = await this.assertEnrolledStudent(subject, groupId);
    const publishedBadges = await this.badgeRepository.find({
      where: { groupId, isPublished: true },
      order: { id: 'ASC' },
    });
    const earnedBadgeIds = publishedBadges.some((badge) => badge.isSecret)
      ? await this.findEarnedBadgeIdsForEnrollment(enrollment.id)
      : new Set<number>();
    return publishedBadges.map((badge) => toVisibleBadge({ badge, canSeeSecret: earnedBadgeIds.has(badge.id) }));
  }

  async updateBadge(req: Request, groupId: number, badgeId: number, dto: UpdateBadgeDto): Promise<BadgeEntity> {
    await this.groupAuthorizationService.assertLecturerOwnsGroupFromRequest(req, groupId, dto.auth);
    const badge = await this.badgeRepository.findOne({ where: { id: badgeId, groupId } });
    if (!badge) {
      throw new NotFoundException(`Badge with id ${badgeId} not found in group ${groupId}`);
    }
    const isPublishingNow = dto.isPublished === true && !badge.isPublished;
    if (dto.name !== undefined) badge.name = dto.name;
    if (dto.icon !== undefined) badge.icon = dto.icon;
    if (dto.educationalDescription !== undefined) badge.educationalDescription = dto.educationalDescription;
    if (dto.storyDescription !== undefined) badge.storyDescription = dto.storyDescription;
    if (dto.rewardAmount !== undefined) badge.rewardAmount = dto.rewardAmount;
    if (dto.rarity !== undefined) badge.rarity = dto.rarity;
    if (dto.globalDiscountType !== undefined) badge.globalDiscountType = dto.globalDiscountType;
    if (dto.globalDiscountValue !== undefined) badge.globalDiscountValue = dto.globalDiscountValue;
    if (dto.isSecret !== undefined) badge.isSecret = dto.isSecret;
    if (dto.isPublished !== undefined) {
      badge.isPublished = dto.isPublished;
      badge.publishedAt = dto.isPublished ? new Date() : null;
    }
    const saved = await this.badgeRepository.save(badge);
    if (isPublishingNow) {
      await this.backlogService.notifyEnrolledStudents(groupId, 'BADGE_ADDED', this.buildBadgeAddedPayload(saved));
    }
    this.logger.log(`Badge "${saved.name}" (id=${saved.id}) updated in group ${groupId}`);
    return saved;
  }

  /**
   * Deletes a badge and revokes it from all students (currency only; totalEarned unchanged).
   */
  async deleteBadge(
    req: Request,
    groupId: number,
    badgeId: number,
    bodyAuth?: string): Promise<DeleteBadgeResponse> {
    await this.groupAuthorizationService.assertLecturerOwnsGroupFromRequest(req, groupId, bodyAuth);
    const badge = await this.badgeRepository.findOne({ where: { id: badgeId, groupId } });
    if (!badge) {
      throw new NotFoundException(`Badge with id ${badgeId} not found in group ${groupId}`);
    }
    const rewardAmount = badge.rewardAmount ?? 0;
    const earnedRows = await this.earnedBadgeRepository.find({ where: { badgeId } });
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let revokedFromStudents = 0;
    try {
      for (const earned of earnedRows) {
        if (earned.enrollmentId !== null) {
          await applyBadgeRevokeDelta(
            queryRunner,
            this.ranksService,
            earned.enrollmentId,
            groupId,
            rewardAmount);
          revokedFromStudents += 1;
        }
        await queryRunner.manager.remove(EarnedBadgeEntity, earned);
      }
      await queryRunner.manager.remove(BadgeEntity, badge);
      await queryRunner.commitTransaction();
      this.logger.log(
        `Badge (id=${badgeId}) deleted from group ${groupId}; revokedFromStudents=${revokedFromStudents}`);
      return { deleted: true, revokedFromStudents };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Delete badge failed (badge=${badgeId}, group=${groupId}): ${String(err)}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async createBadge(req: Request, groupId: number, dto: CreateBadgeDto): Promise<BadgeEntity> {
    await this.groupAuthorizationService.assertLecturerOwnsGroupFromRequest(req, groupId, dto.auth);
    await this.assertGroupExists(groupId);
    const isPublished = dto.isPublished ?? false;
    const entity = this.badgeRepository.create({
      groupId,
      name: dto.name,
      icon: dto.icon,
      educationalDescription: dto.educationalDescription ?? '',
      storyDescription: dto.storyDescription ?? null,
      rewardAmount: dto.rewardAmount ?? 0,
      rarity: dto.rarity ?? BadgeRarity.COMMON,
      globalDiscountType: dto.globalDiscountType ?? null,
      globalDiscountValue: dto.globalDiscountValue ?? 0,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
      isSecret: dto.isSecret ?? false,
    });
    const saved = await this.badgeRepository.save(entity);
    if (saved.isPublished) {
      await this.backlogService.notifyEnrolledStudents(groupId, 'BADGE_ADDED', this.buildBadgeAddedPayload(saved));
    }
    this.logger.log(`Badge "${saved.name}" (id=${saved.id}, secret=${saved.isSecret}) created for group ${groupId}`);
    return saved;
  }

  /**
   * Student notification for a published badge. A secret badge never exposes its name.
   */
  private buildBadgeAddedPayload(badge: BadgeEntity): BacklogPayload {
    if (badge.isSecret) {
      return { message: 'Dodano nową sekretną odznakę.', badgeId: badge.id, isSecret: true };
    }
    return { message: `Dodano nową odznakę: ${badge.name}.`, badgeId: badge.id, badgeName: badge.name };
  }

  /**
   * Verifies that a non-owner caller has a student enrollment in the target group.
   */
  private async assertEnrolledStudent(subject: SessionSubject, groupId: number): Promise<EnrollmentEntity> {
    const studentAccountId = subject.organizationId != null
      ? await this.userRolesService.findAccountIdForRoleInOrganization(
        subject.userId,
        subject.organizationId,
        STUDENT_ROLE_NAME)
      : await this.userRolesService.findAccountIdForRole(subject.userId, STUDENT_ROLE_NAME);
    if (studentAccountId === null) {
      throw new ForbiddenException('Not authorized to access badges in this group');
    }
    const enrollment = await this.enrollmentRepository.findOne({ where: { groupId, studentAccountId } });
    if (!enrollment) {
      throw new ForbiddenException('Not authorized to access badges in this group');
    }
    return enrollment;
  }

  private async findEarnedBadgeIdsForEnrollment(enrollmentId: number): Promise<ReadonlySet<number>> {
    const earnedRows = await this.earnedBadgeRepository.find({ where: { enrollmentId } });
    return new Set(earnedRows.map((row) => row.badgeId).filter((badgeId): badgeId is number => badgeId !== null));
  }

  private async assertGroupExists(groupId: number): Promise<void> {
    const exists = await this.groupRepository.exist({ where: { id: groupId } });
    if (!exists) {
      throw new NotFoundException(`Group with id ${groupId} not found`);
    }
  }
}
