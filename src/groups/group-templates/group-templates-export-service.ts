import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { GroupEntity } from '../../database/entities/group.entity';
import { BadgeEntity } from '../../database/entities/badge.entity';
import { RankEntity } from '../../database/entities/rank.entity';
import { ItemCategoryEntity } from '../../database/entities/item-category.entity';
import { ItemEntity } from '../../database/entities/item.entity';
import { ShopListingEntity } from '../../database/entities/shop-listing.entity';
import { PostEntity } from '../../database/entities/post.entity';
import { StageEntity } from '../../database/entities/stage.entity';
import { ActivityEntity } from '../../database/entities/activity.entity';
import { GroupTemplateEntity } from '../../database/entities/group-template.entity';

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
      const group = await manager.findOne(GroupEntity, { where: { id: groupId } });
      if (!group) {
        throw new NotFoundException(`Group ${groupId} not found`);
      }

      const badges = await manager.find(BadgeEntity, { where: { groupId } });
      const ranks = await manager.find(RankEntity, { where: { groupId } });
      const itemCategories = await manager.find(ItemCategoryEntity, { where: { groupId } });
      
      const items = await manager.find(ItemEntity, { where: { groupId } });
      const itemIds = items.map(i => i.id);
      let shopListings: ShopListingEntity[] = [];
      if (itemIds.length > 0) {
        shopListings = await manager.createQueryBuilder(ShopListingEntity, 'sl')
          .where('sl.item_id IN (:...itemIds)', { itemIds })
          .getMany();
      }

      const posts = await manager.find(PostEntity, { where: { groupId } });

      const stages = await manager.find(StageEntity, { where: { groupId } });
      const stageIds = stages.map(s => s.id);
      let activities: ActivityEntity[] = [];
      if (stageIds.length > 0) {
        activities = await manager.createQueryBuilder(ActivityEntity, 'act')
          .where('act.stage_id IN (:...stageIds)', { stageIds })
          .getMany();
      }

      const data = {
        group: {
          name: group.name,
          subjectName: group.subjectName,
          imageRef: group.imageRef,
          description: group.description,
          currency: group.currency,
          currencyIcon: group.currencyIcon,
          lives: group.lives,
          livesIcon: group.livesIcon,
        },
        badges,
        ranks,
        itemCategories,
        items: items.map(item => {
          const listing = shopListings.find(sl => sl.itemId === item.id);
          return {
            ...item,
            listing,
          };
        }),
        posts,
        stages: stages.map(stage => {
          const stageActivities = activities.filter(a => a.stageId === stage.id);
          return {
            ...stage,
            activities: stageActivities,
          };
        })
      };

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
