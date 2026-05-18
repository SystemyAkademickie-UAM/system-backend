import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GroupEntity } from '../database/entities/group.entity';
import { RankEntity } from '../database/entities/rank.entity';
import { CreateRankDto } from './dto/create-rank.dto';

/**
 * Persists rank definitions in `gamification.ranks` for a given course group.
 */
@Injectable()
export class RanksService {
  private readonly logger = new Logger(RanksService.name);

  constructor(
    @InjectRepository(RankEntity)
    private readonly rankRepository: Repository<RankEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) {}

  /**
   * Creates a new rank bound to the given group.
   * @param groupId - Internal `education.groups.id`
   * @param dto     - Validated payload from the controller
   * @returns The persisted rank entity
   */
  async createRank(groupId: number, dto: CreateRankDto): Promise<RankEntity> {
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
