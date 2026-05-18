import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BadgeEntity } from '../database/entities/badge.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { RankEntity } from '../database/entities/rank.entity';
import { BadgesService } from './badges-service';
import { RanksService } from './ranks-service';

/**
 * Gamification domain module – badges & ranks management.
 * Exports services so they can be injected in `GroupsModule`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([BadgeEntity, RankEntity, GroupEntity])],
  providers: [BadgesService, RanksService],
  exports: [BadgesService, RanksService],
})
export class GamificationModule {}
