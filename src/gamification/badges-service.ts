import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { BadgeEntity, BadgeRarity } from '../database/entities/badge.entity';
import { EarnedBadgeEntity } from '../database/entities/earned-badge.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { RanksService } from './ranks-service';
import { applyBadgeRevokeDelta } from '../student-management/student-stats-reward.helper';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { UpdateBadgeDto } from './dto/update-badge.dto';

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
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    private readonly ranksService: RanksService,
    private readonly dataSource: DataSource,
    @InjectRepository(BadgeEntity)
    private readonly badgeRepository: Repository<BadgeEntity>,
    @InjectRepository(EarnedBadgeEntity)
    private readonly earnedBadgeRepository: Repository<EarnedBadgeEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) {}

  async getBadgesForGroup(req: Request, groupId: number, queryAuth?: string): Promise<BadgeEntity[]> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, queryAuth);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    await this.assertGroupExists(groupId);
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);

    const whereClause: any = { groupId };
    if (!isLecturer) {
      whereClause.isPublished = true;
    }

    return this.badgeRepository.find({
      where: whereClause,
      order: { id: 'ASC' },
    });
  }

  async updateBadge(req: Request, groupId: number, badgeId: number, dto: UpdateBadgeDto): Promise<BadgeEntity> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, dto.auth);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }
    const badge = await this.badgeRepository.findOne({ where: { id: badgeId, groupId } });
    if (!badge) {
      throw new NotFoundException(`Badge with id ${badgeId} not found in group ${groupId}`);
    }
    if (dto.name !== undefined) badge.name = dto.name;
    if (dto.icon !== undefined) badge.icon = dto.icon;
    if (dto.educationalDescription !== undefined) badge.educationalDescription = dto.educationalDescription;
    if (dto.storyDescription !== undefined) badge.storyDescription = dto.storyDescription;
    if (dto.rewardAmount !== undefined) badge.rewardAmount = dto.rewardAmount;
    if (dto.rarity !== undefined) badge.rarity = dto.rarity;
    if (dto.isPublished !== undefined) {
      badge.isPublished = dto.isPublished;
      badge.publishedAt = dto.isPublished ? new Date() : null;
    }
    const saved = await this.badgeRepository.save(badge);
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
    bodyAuth?: string,
  ): Promise<DeleteBadgeResponse> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, bodyAuth);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }
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
            rewardAmount,
          );
          revokedFromStudents += 1;
        }
        await queryRunner.manager.remove(EarnedBadgeEntity, earned);
      }
      await queryRunner.manager.remove(BadgeEntity, badge);
      await queryRunner.commitTransaction();
      this.logger.log(
        `Badge (id=${badgeId}) deleted from group ${groupId}; revokedFromStudents=${revokedFromStudents}`,
      );
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
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, dto.auth);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }
    await this.assertGroupExists(groupId);
    const entity = this.badgeRepository.create({
      groupId,
      name: dto.name,
      icon: dto.icon,
      educationalDescription: dto.educationalDescription ?? '',
      storyDescription: dto.storyDescription ?? null,
      rewardAmount: dto.rewardAmount ?? 0,
      rarity: dto.rarity ?? BadgeRarity.COMMON,
    });
    const saved = await this.badgeRepository.save(entity);
    this.logger.log(`Badge "${saved.name}" (id=${saved.id}) created for group ${groupId}`);
    return saved;
  }

  private async assertGroupExists(groupId: number): Promise<void> {
    const exists = await this.groupRepository.exist({ where: { id: groupId } });
    if (!exists) {
      throw new NotFoundException(`Group with id ${groupId} not found`);
    }
  }
}
