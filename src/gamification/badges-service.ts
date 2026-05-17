import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BadgeEntity } from '../database/entities/badge.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { CreateBadgeDto } from './dto/create-badge.dto';

/**
 * Persists badge definitions in `gamification.badges` for a given course group.
 */
@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    @InjectRepository(BadgeEntity)
    private readonly badgeRepository: Repository<BadgeEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) {}

  /**
   * Creates a new badge bound to the given group.
   * @param groupId - Internal `education.groups.id`
   * @param dto     - Validated payload from the controller
   * @returns The persisted badge entity
   */
  async createBadge(groupId: number, dto: CreateBadgeDto): Promise<BadgeEntity> {
    await this.assertGroupExists(groupId);

    const entity = this.badgeRepository.create({
      groupId,
      name: dto.name,
      icon: dto.icon,
      educationalDescription: dto.educationalDescription,
      storyDescription: dto.storyDescription ?? null,
      rewardAmount: dto.rewardAmount ?? 0,
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
