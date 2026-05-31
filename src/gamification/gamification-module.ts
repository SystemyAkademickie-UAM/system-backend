import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { BadgeEntity } from '../database/entities/badge.entity';
import { EarnedBadgeEntity } from '../database/entities/earned-badge.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { RankEntity } from '../database/entities/rank.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { BadgesService } from './badges-service';
import { RanksService } from './ranks-service';

/**
 * Gamification domain module – badges & ranks management.
 * Exports services so they can be injected in `GroupsModule`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([BadgeEntity, EarnedBadgeEntity, RankEntity, GroupEntity]),
    AuthTokenSessionModule,
    UserRolesModule,
  ],
  providers: [BadgesService, RanksService],
  exports: [BadgesService, RanksService],
})
export class GamificationModule {}
