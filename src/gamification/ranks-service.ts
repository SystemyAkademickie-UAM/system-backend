import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
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
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(RankEntity)
    private readonly rankRepository: Repository<RankEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) {}

  /**
   * Returns all ranks for a group, ordered by requiredPoints ascending.
   * Auth is read from `maq_auth` cookie OR query `auth` parameter (soft token resolution).
   */
  async getRanksForGroup(req: Request, groupId: number, queryAuth?: string): Promise<RankEntity[]> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, queryAuth);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
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
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, dto.auth);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
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
    if (dto.storeDiscount !== undefined) rank.storeDiscount = dto.storeDiscount;
    if (dto.uniqueStoreItems !== undefined) rank.uniqueStoreItems = dto.uniqueStoreItems;

    const saved = await this.rankRepository.save(rank);
    this.logger.log(`Rank "${saved.name}" (id=${saved.id}) updated in group ${groupId}`);
    return saved;
  }

  /**
   * Deletes a rank from a group.
   */
  async deleteRank(req: Request, groupId: number, rankId: number, bodyAuth?: string): Promise<{ deleted: boolean }> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, bodyAuth);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }

    const rank = await this.rankRepository.findOne({ where: { id: rankId, groupId } });
    if (!rank) {
      throw new NotFoundException(`Rank with id ${rankId} not found in group ${groupId}`);
    }

    await this.rankRepository.remove(rank);
    this.logger.log(`Rank (id=${rankId}) deleted from group ${groupId}`);
    return { deleted: true };
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
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, dto.auth);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
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
      storeDiscount: dto.storeDiscount ?? 0,
      uniqueStoreItems: dto.uniqueStoreItems ?? null,
    });

    const saved = await this.rankRepository.save(entity);
    this.logger.log(`Rank "${saved.name}" (id=${saved.id}) created for group ${groupId}`);
    return saved;
  }

  private async assertGroupExists(groupId: number): Promise<void> {
    const exists = await this.groupRepository.exist({ where: { id: groupId } });
    if (!exists) {
      throw new NotFoundException(`Group with id ${groupId} not found`);
    }
  }
}
