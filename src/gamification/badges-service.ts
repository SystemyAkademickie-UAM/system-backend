import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { BadgeEntity, BadgeRarity } from '../database/entities/badge.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { UpdateBadgeDto } from './dto/update-badge.dto';

/**
 * Persists badge definitions in `gamification.badges` for a given course group.
 */
@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(BadgeEntity)
    private readonly badgeRepository: Repository<BadgeEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) {}

  /**
   * Returns all badges for a group.
   * Auth is read from `maq_auth` cookie OR query `auth` parameter (soft token resolution).
   */
  async getBadgesForGroup(req: Request, groupId: number, queryAuth?: string): Promise<BadgeEntity[]> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, queryAuth);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    await this.assertGroupExists(groupId);
    return this.badgeRepository.find({
      where: { groupId },
      order: { id: 'ASC' },
    });
  }

  /**
   * Updates an existing badge.
   */
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

    const saved = await this.badgeRepository.save(badge);
    this.logger.log(`Badge "${saved.name}" (id=${saved.id}) updated in group ${groupId}`);
    return saved;
  }

  /**
   * Deletes a badge from a group.
   */
  async deleteBadge(req: Request, groupId: number, badgeId: number, bodyAuth?: string): Promise<{ deleted: boolean }> {
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

    await this.badgeRepository.remove(badge);
    this.logger.log(`Badge (id=${badgeId}) deleted from group ${groupId}`);
    return { deleted: true };
  }

  /**
   * Creates a new badge bound to the given group.
   * Auth is read from `maq_auth` cookie OR body `auth` field (soft token resolution).
   * @param req     - Express request (cookie / body auth)
   * @param groupId - Internal `education.groups.id`
   * @param dto     - Validated payload from the controller
   * @returns The persisted badge entity
   */
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
      educationalDescription: dto.educationalDescription,
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
