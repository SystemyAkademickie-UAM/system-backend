import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { BadgeEntity } from '../database/entities/badge.entity';
import { EarnedBadgeEntity } from '../database/entities/earned-badge.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { ItemCategoryEntity } from '../database/entities/item-category.entity';
import { RankEntity } from '../database/entities/rank.entity';
import { ItemEntity } from '../database/entities/item.entity';
import { ShopListingEntity } from '../database/entities/shop-listing.entity';
import { DefaultItemTemplateEntity } from '../database/entities/default-item-template.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { BadgesService } from './badges-service';
import { ItemCategoriesService } from './item-categories-service';
import { RanksService } from './ranks-service';
import { ShopItemsService } from './shop-items-service';
import { ShopTemplatesService } from './shop-templates-service';

import { IconsController } from './icons-controller';
import { ShopTemplatesController } from './shop-templates-controller';

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
      ItemEntity,
      ShopListingEntity,
      DefaultItemTemplateEntity,
      EnrollmentEntity,
    ]),
    AuthTokenSessionModule,
    UserRolesModule,
  ],
  controllers: [IconsController, ShopTemplatesController],
  providers: [BadgesService, RanksService, ItemCategoriesService, ShopItemsService, ShopTemplatesService],
  exports: [BadgesService, RanksService, ItemCategoriesService, ShopItemsService, ShopTemplatesService],
})
export class GamificationModule {}
