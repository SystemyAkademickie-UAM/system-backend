import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

import type {
  GroupTemplateData,
  GroupTemplateItem,
  GroupTemplateShopListing,
  GroupTemplateShopListingBadgePromotion,
  GroupTemplateShopListingRankPromotion,
} from './group-template-data.interface';

@Injectable()
export class GroupTemplatesExportService {
  private readonly logger = new Logger(GroupTemplatesExportService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async exportGroupToTemplate(
    groupId: number,
    creatorAccountId: number,
    templateName: string,
    description: string | undefined,
    isPublic: boolean = false,
  ): Promise<GroupTemplateEntity> {
    return this.dataSource.transaction(async (manager) => {
      // ── Group ──────────────────────────────────────────────
      const group = await manager.findOne(GroupEntity, { where: { id: groupId } });
      if (!group) {
        throw new NotFoundException(`Group ${groupId} not found`);
      }

      // ── Badges & Ranks ─────────────────────────────────────
      const badges = await manager.find(BadgeEntity, { where: { groupId } });
      const ranks = await manager.find(RankEntity, { where: { groupId } });

      // ── Item Categories ────────────────────────────────────
      const itemCategories = await manager.find(ItemCategoryEntity, { where: { groupId } });

      // ── Items + Shop Listings ──────────────────────────────
      const items = await manager.find(ItemEntity, { where: { groupId } });
      const itemIds = items.map((i) => i.id);

      let shopListings: ShopListingEntity[] = [];
      if (itemIds.length > 0) {
        shopListings = await manager
          .createQueryBuilder(ShopListingEntity, 'sl')
          .where('sl.item_id IN (:...itemIds)', { itemIds })
          .getMany();
      }

      // ── Shop Listing Rank Promotions (raw query — no entity) ──
      const listingIds = shopListings.map((sl) => sl.id);
      let rankPromotionsRaw: Array<{ shop_listing_id: number; rank_id: number; promotion_type: string; value: number }> = [];
      if (listingIds.length > 0) {
        rankPromotionsRaw = await manager.query(
          `SELECT shop_listing_id, rank_id, promotion_type, value
           FROM gamification.shop_listing_rank_promotions
           WHERE shop_listing_id = ANY($1)`,
          [listingIds],
        );
      }

      // ── Shop Listing Badge Promotions (raw query — no entity)
      let badgePromotionsRaw: Array<{
        shop_listing_id: number;
        badge_id: number;
        promotion_type: string;
        value: number;
      }> = [];
      if (listingIds.length > 0) {
        badgePromotionsRaw = await manager.query(
          `SELECT shop_listing_id, badge_id, promotion_type, value
           FROM gamification.shop_listing_badge_promotions
           WHERE shop_listing_id = ANY($1)`,
          [listingIds],
        );
      }

      // ── Posts ───────────────────────────────────────────────
      const posts = await manager.find(PostEntity, { where: { groupId } });

      // ── Stages + Activities ────────────────────────────────
      const stages = await manager.find(StageEntity, {
        where: { groupId },
        order: { displayOrder: { direction: 'ASC', nulls: 'LAST' }, id: 'ASC' } as any,
      });
      const stageIds = stages.map((s) => s.id);
      let activities: ActivityEntity[] = [];
      if (stageIds.length > 0) {
        activities = await manager
          .createQueryBuilder(ActivityEntity, 'act')
          .where('act.stage_id IN (:...stageIds)', { stageIds })
          .getMany();
      }

      // ── Assemble typed snapshot ────────────────────────────
      const templateItems: GroupTemplateItem[] = items.map((item) => {
        const listing = shopListings.find((sl) => sl.itemId === item.id);
        let templateListing: GroupTemplateShopListing | null = null;

        if (listing) {
          const rp: GroupTemplateShopListingRankPromotion[] = rankPromotionsRaw
            .filter((r) => r.shop_listing_id === listing.id)
            .map((r) => ({ rankId: r.rank_id, promotionType: r.promotion_type, value: r.value }));

          const bp: GroupTemplateShopListingBadgePromotion[] = badgePromotionsRaw
            .filter((b) => b.shop_listing_id === listing.id)
            .map((b) => ({
              badgeId: b.badge_id,
              promotionType: b.promotion_type,
              value: b.value,
            }));

          templateListing = {
            basePrice: listing.basePrice,
            stockQuantity: listing.stockQuantity,
            perStudentLimit: listing.perStudentLimit,
            rankPromotions: rp,
            badgePromotions: bp,
          };
        }

        return {
          id: item.id,
          groupId: item.groupId,
          categoryId: item.categoryId,
          imageRef: item.imageRef,
          name: item.name,
          educationalDescription: item.educationalDescription,
          listing: templateListing,
        };
      });

      const data: GroupTemplateData = {
        group: {
          name: group.name,
          subjectName: group.subjectName,
          imageRef: group.imageRef,
          description: group.description,
          currency: group.currency,
          currencyEmoji: group.currencyEmoji,
          lives: group.lives,
          startingLives: group.startingLives,
          livesIcon: group.livesIcon,
        },
        badges,
        ranks,
        itemCategories,
        items: templateItems,
        posts: posts.map((p) => ({ title: p.title, content: p.content })),
        stages: stages.map((stage) => ({
          id: stage.id,
          groupId: stage.groupId,
          name: stage.name,
          displayOrder: stage.displayOrder ?? null,
          activities: activities
            .filter((a) => a.stageId === stage.id)
            .map((a) => ({
              name: a.name,
              currency: a.currency,
              educationalDescription: a.educationalDescription,
              storyDescription: a.storyDescription,
            })),
        })),
      };

      // ── Persist ────────────────────────────────────────────
      const template = manager.create(GroupTemplateEntity, {
        name: templateName,
        description: description || null,
        isPublic,
        creatorAccountId,
        baseGroupId: groupId,
        data,
      });

      const savedTemplate = await manager.save(GroupTemplateEntity, template);
      this.logger.log(`Exported group ${groupId} to template ${savedTemplate.id}`);

      return savedTemplate;
    });
  }
}
