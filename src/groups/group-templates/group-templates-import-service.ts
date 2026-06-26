import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { ActivityEntity } from '../../database/entities/activity.entity';
import { BadgeEntity } from '../../database/entities/badge.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { GroupTemplateEntity } from '../../database/entities/group-template.entity';
import { ItemCategoryEntity } from '../../database/entities/item-category.entity';
import { ItemEntity } from '../../database/entities/item.entity';
import { PostEntity } from '../../database/entities/post.entity';
import { RankEntity } from '../../database/entities/rank.entity';
import { ShopListingEntity } from '../../database/entities/shop-listing.entity';
import { StageEntity } from '../../database/entities/stage.entity';

import type { GroupTemplateData } from './group-template-data.interface';
import { mapLegacyBadgeDiscount, mapLegacyRankDiscount } from './group-template-legacy-discount';
import { ShopItemsService } from '../../gamification/shop-items-service';

@Injectable()
export class GroupTemplatesImportService {
  private readonly logger = new Logger(GroupTemplatesImportService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly shopItemsService: ShopItemsService,
  ) {}

  async createGroupFromTemplate(
    templateId: number,
    lecturerAccountId: number,
    newGroupName: string,
    newSubjectName?: string,
  ): Promise<GroupEntity> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Fetch template
      const template = await manager.findOne(GroupTemplateEntity, { where: { id: templateId } });
      if (!template) {
        throw new NotFoundException(`Group template ${templateId} not found`);
      }

      if (!template.isPublic && template.creatorAccountId !== lecturerAccountId) {
        throw new ForbiddenException(`Cannot import private template ${templateId}`);
      }

      const data = template.data as GroupTemplateData;

      // 2. Create the base group
      const groupPayload = data.group;
      const groupEntity = manager.create(GroupEntity, {
        teacherAccountId: lecturerAccountId,
        name: newGroupName,
        subjectName: newSubjectName ?? groupPayload.subjectName,
        imageRef: groupPayload.imageRef,
        description: groupPayload.description,
        currency: groupPayload.currency,
        currencyEmoji: groupPayload.currencyEmoji,
        lives: groupPayload.lives,
        startingLives: groupPayload.startingLives,
        livesIcon: groupPayload.livesIcon,
      });
      const savedGroup = await manager.save(GroupEntity, groupEntity);
      const newGroupId = savedGroup.id;

      await this.shopItemsService.ensureDefaultExtraLifeItem(newGroupId, manager);

      // 3. Create Badges & keep ID mapping
      const badgeIdMap = new Map<number, number>(); // old -> new
      for (const oldBadge of data.badges || []) {
        const badgeDiscount = mapLegacyBadgeDiscount(oldBadge);
        const badgeEntity = manager.create(BadgeEntity, {
          groupId: newGroupId,
          name: oldBadge.name,
          educationalDescription: oldBadge.educationalDescription,
          icon: oldBadge.icon,
          storyDescription: oldBadge.storyDescription,
          rewardAmount: oldBadge.rewardAmount,
          rarity: oldBadge.rarity,
          globalDiscountType: badgeDiscount.globalDiscountType,
          globalDiscountValue: badgeDiscount.globalDiscountValue,
        });
        const savedBadge = await manager.save(BadgeEntity, badgeEntity);
        badgeIdMap.set(oldBadge.id, savedBadge.id);
      }

      // 4. Create Ranks & keep ID mapping
      const rankIdMap = new Map<number, number>(); // old -> new
      for (const oldRank of data.ranks || []) {
        const rankDiscount = mapLegacyRankDiscount(oldRank);
        const rankEntity = manager.create(RankEntity, {
          groupId: newGroupId,
          name: oldRank.name,
          requiredPoints: oldRank.requiredPoints,
          icon: oldRank.icon,
          storyDescription: oldRank.storyDescription,
          uniqueStoreItems: oldRank.uniqueStoreItems, // raw strings, no ID mapping needed usually
          globalDiscountType: rankDiscount.globalDiscountType,
          globalDiscountValue: rankDiscount.globalDiscountValue,
        });
        const savedRank = await manager.save(RankEntity, rankEntity);
        rankIdMap.set(oldRank.id, savedRank.id);
      }

      // 5. Create Item Categories & keep ID mapping
      const categoryIdMap = new Map<number, number>(); // old -> new
      for (const oldCat of data.itemCategories || []) {
        const catEntity = manager.create(ItemCategoryEntity, {
          groupId: newGroupId,
          name: oldCat.name,
          description: oldCat.description,
          displayOrder: oldCat.displayOrder,
          color: oldCat.color ?? null,
        });
        const savedCat = await manager.save(ItemCategoryEntity, catEntity);
        categoryIdMap.set(oldCat.id, savedCat.id);
      }

      // 6. Create Items & Shop Listings
      for (const oldItem of data.items || []) {
        // Map category
        const newCategoryId = oldItem.categoryId ? categoryIdMap.get(oldItem.categoryId) ?? null : null;

        const itemEntity = manager.create(ItemEntity, {
          groupId: newGroupId,
          categoryId: newCategoryId,
          imageRef: oldItem.imageRef,
          name: oldItem.name,
          educationalDescription: oldItem.educationalDescription,
        });
        const savedItem = await manager.save(ItemEntity, itemEntity);

        // If it had a shop listing, create it
        if (oldItem.listing) {
          const listingEntity = manager.create(ShopListingEntity, {
            itemId: savedItem.id,
            basePrice: oldItem.listing.basePrice,
            stockQuantity: oldItem.listing.stockQuantity,
            perStudentLimit: oldItem.listing.perStudentLimit,
          });
          const savedListing = await manager.save(ShopListingEntity, listingEntity);

          // 6a. Rank Promotions
          for (const rp of oldItem.listing.rankPromotions || []) {
            const mappedRankId = rankIdMap.get(rp.rankId);
            if (mappedRankId) {
              await manager.query(
                `INSERT INTO gamification.shop_listing_rank_promotions (shop_listing_id, rank_id, promotion_type, value)
                 VALUES ($1, $2, $3, $4)`,
                [savedListing.id, mappedRankId, rp.promotionType, rp.value],
              );
            }
          }

          // 6b. Badge Promotions
          for (const bp of oldItem.listing.badgePromotions || []) {
            const mappedBadgeId = badgeIdMap.get(bp.badgeId);
            if (mappedBadgeId) {
              await manager.query(
                `INSERT INTO gamification.shop_listing_badge_promotions (shop_listing_id, badge_id, promotion_type, value)
                 VALUES ($1, $2, $3, $4)`,
                [savedListing.id, mappedBadgeId, bp.promotionType, bp.value],
              );
            }
          }
        }
      }

      // 7. Create Posts
      for (const oldPost of data.posts || []) {
        const postEntity = manager.create(PostEntity, {
          groupId: newGroupId,
          title: oldPost.title,
          content: oldPost.content,
        });
        await manager.save(PostEntity, postEntity);
      }

      // 8. Create Stages & Activities
      for (const oldStage of data.stages || []) {
        const stageEntity = manager.create(StageEntity, {
          groupId: newGroupId,
          name: oldStage.name,
          displayOrder: oldStage.displayOrder ?? null,
        });
        const savedStage = await manager.save(StageEntity, stageEntity);

        for (const oldActivity of oldStage.activities || []) {
          const actEntity = manager.create(ActivityEntity, {
            stageId: savedStage.id,
            name: oldActivity.name,
            currency: oldActivity.currency,
            educationalDescription: oldActivity.educationalDescription,
            storyDescription: oldActivity.storyDescription,
          });
          await manager.save(ActivityEntity, actEntity);
        }
      }

      this.logger.log(`Created new group ${newGroupId} from template ${templateId}`);

      return savedGroup;
    });
  }
}
