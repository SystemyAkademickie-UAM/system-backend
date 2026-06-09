import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { BadgeEntity } from '../database/entities/badge.entity';
import { EarnedBadgeEntity } from '../database/entities/earned-badge.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { ItemCategoryEntity } from '../database/entities/item-category.entity';
import { RankEntity } from '../database/entities/rank.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { BadgesService } from './badges-service';
import { ItemCategoriesService } from './item-categories-service';
import { RanksService } from './ranks-service';

import { IconsController } from './icons-controller';

/**
 * Gamification domain module – badges, ranks, and shop item categories.
 * Exports services so they can be injected in `GroupsModule`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      BadgeEntity,
      EarnedBadgeEntity,
      RankEntity,
      GroupEntity,
      ItemCategoryEntity,
      EnrollmentEntity,
    ]),
    AuthTokenSessionModule,
    UserRolesModule,
  ],
  controllers: [IconsController],
  providers: [BadgesService, RanksService, ItemCategoriesService],
  exports: [BadgesService, RanksService, ItemCategoriesService],
})
export class GamificationModule {}
