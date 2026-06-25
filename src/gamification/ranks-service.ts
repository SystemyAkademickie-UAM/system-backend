import { ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { GroupEntity } from '../database/entities/group.entity';
import { RankEntity } from '../database/entities/rank.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { CreateRankDto } from './dto/create-rank.dto';
import { UpdateRankDto } from './dto/update-rank.dto';

/**
 * Persists rank definitions in `gamification.ranks` for a given course group.
 */
@Injectable()
export class RanksService {
  private readonly logger = new Logger(RanksService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(RankEntity)
    private readonly rankRepository: Repository<RankEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    private readonly dataSource: DataSource) {}

  /**
   * Returns all ranks for a group, ordered by requiredPoints ascending.
   * Auth is read from `maq_auth` cookie OR query `auth` parameter (soft token resolution).
   */
  async getRanksForGroup(req: Request, groupId: number, queryAuth?: string): Promise<RankEntity[]> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, queryAuth);
    if (!subject) {
      throw new UnauthorizedException('Not authorized');
    }
    await this.assertGroupExists(groupId);
    return this.rankRepository.find({
      where: { groupId },
      order: { requiredPoints: 'ASC' },
    });
  }

  /**
   * Updates an existing rank.
   */
  async updateRank(req: Request, groupId: number, rankId: number, dto: UpdateRankDto): Promise<RankEntity> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, dto.auth);
    if (!subject) {
      throw new UnauthorizedException('Not authorized');
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }

    const rank = await this.rankRepository.findOne({ where: { id: rankId, groupId } });
    if (!rank) {
      throw new NotFoundException(`Rank with id ${rankId} not found in group ${groupId}`);
    }

    if (dto.name !== undefined) rank.name = dto.name;
    if (dto.icon !== undefined) rank.icon = dto.icon;
    if (dto.requiredPoints !== undefined) rank.requiredPoints = dto.requiredPoints;
    if (dto.storyDescription !== undefined) rank.storyDescription = dto.storyDescription;
    if (dto.uniqueStoreItems !== undefined) rank.uniqueStoreItems = dto.uniqueStoreItems;
    if (dto.globalDiscountType !== undefined) rank.globalDiscountType = dto.globalDiscountType;
    if (dto.globalDiscountValue !== undefined) rank.globalDiscountValue = dto.globalDiscountValue;

    const saved = await this.rankRepository.save(rank);
    await this.recalculateRanksForGroup(groupId);
    this.logger.log(`Rank "${saved.name}" (id=${saved.id}) updated in group ${groupId}`);
    return saved;
  }

  /**
   * Deletes a rank from a group.
   */
  async deleteRank(req: Request, groupId: number, rankId: number, bodyAuth?: string): Promise<{ deleted: boolean }> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, bodyAuth);
    if (!subject) {
      throw new UnauthorizedException('Not authorized');
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }

    const rank = await this.rankRepository.findOne({ where: { id: rankId, groupId } });
    if (!rank) {
      throw new NotFoundException(`Rank with id ${rankId} not found in group ${groupId}`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(
        `UPDATE gamification.student_stats
         SET rank_id = NULL
         WHERE rank_id = $1
           AND enrollment_id IN (
             SELECT id FROM gamification.enrollments WHERE group_id = $2
           )`,
        [rankId, groupId]);
      await queryRunner.manager.remove(RankEntity, rank);
      await queryRunner.commitTransaction();
      this.logger.log(`Rank (id=${rankId}) deleted from group ${groupId}`);
      return { deleted: true };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Delete rank failed (rank=${rankId}, group=${groupId}): ${String(err)}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Creates a new rank bound to the given group.
   * Auth is read from `maq_auth` cookie OR body `auth` field (soft token resolution).
   * @param req     - Express request (cookie / body auth)
   * @param groupId - Internal `education.groups.id`
   * @param dto     - Validated payload from the controller
   * @returns The persisted rank entity
   */
  async createRank(req: Request, groupId: number, dto: CreateRankDto): Promise<RankEntity> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, dto.auth);
    if (!subject) {
      throw new UnauthorizedException('Not authorized');
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }

    await this.assertGroupExists(groupId);

    const entity = this.rankRepository.create({
      groupId,
      name: dto.name,
      icon: dto.icon,
      requiredPoints: dto.requiredPoints,
      storyDescription: dto.storyDescription ?? null,
      uniqueStoreItems: dto.uniqueStoreItems ?? null,
      globalDiscountType: dto.globalDiscountType ?? null,
      globalDiscountValue: dto.globalDiscountValue ?? 0,
    });

    const saved = await this.rankRepository.save(entity);
    await this.recalculateRanksForGroup(groupId);
    this.logger.log(`Rank "${saved.name}" (id=${saved.id}) created for group ${groupId}`);
    return saved;
  }

  private async assertGroupExists(groupId: number): Promise<void> {
    const exists = await this.groupRepository.exist({ where: { id: groupId } });
    if (!exists) {
      throw new NotFoundException(`Group with id ${groupId} not found`);
    }
  }

  /**
   * Calculates the highest rank a student can obtain based on their points.
   * Returns null if no rank is available for the given points.
   */
  async calculateRankForPoints(groupId: number, points: number): Promise<number | null> {
    const ranks = await this.rankRepository.find({
      where: { groupId },
      order: { requiredPoints: 'DESC' },
    });
    const rank = ranks.find(r => r.requiredPoints <= points);
    return rank ? rank.id : null;
  }

  /**
   * Recalculates and updates the `rank_id` for all students in a given group.
   * This is necessary when rank thresholds are added, modified or removed.
   */
  private async recalculateRanksForGroup(groupId: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE gamification.student_stats
       SET rank_id = (
           SELECT r.id
           FROM gamification.ranks r
           WHERE r.group_id = $1 AND r.required_points <= gamification.student_stats.total_earned
           ORDER BY r.required_points DESC
           LIMIT 1
       )
       WHERE enrollment_id IN (
           SELECT id FROM gamification.enrollments WHERE group_id = $1
       )`,
      [groupId]);
    this.logger.debug(`Recalculated ranks for all students in group ${groupId}`);
  }
}
