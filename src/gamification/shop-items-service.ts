import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { SessionService, type SessionSubject } from '../auth/session/session.service';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import {
  EXTRA_LIFE_DEFAULT_BASE_PRICE,
  EXTRA_LIFE_DEFAULT_EDUCATIONAL_DESCRIPTION,
  EXTRA_LIFE_DEFAULT_STORY_DESCRIPTION,
  EXTRA_LIFE_ITEM_NAME,
} from '../constants/extra-life-constants';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { ItemEntity } from '../database/entities/item.entity';
import { ItemCategoryEntity } from '../database/entities/item-category.entity';
import { ItemCategoryLinkEntity } from '../database/entities/item-category-link.entity';
import { ShopListingEntity } from '../database/entities/shop-listing.entity';
import { DefaultItemTemplateEntity } from '../database/entities/default-item-template.entity';
import { UserRolesService } from '../user-roles/user-roles-service';
import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { UpdateShopItemDto } from './dto/update-shop-item.dto';

import { ShopListingBadgePromotionEntity } from '../database/entities/shop-listing-badge-promotion.entity';
import { ShopListingRankPromotionEntity } from '../database/entities/shop-listing-rank-promotion.entity';
import { BadgeEntity } from '../database/entities/badge.entity';
import { RankEntity } from '../database/entities/rank.entity';
import { EarnedBadgeEntity } from '../database/entities/earned-badge.entity';
import { StudentStatsEntity } from '../database/entities/student-stats.entity';
import { DiscountCalculator } from './discount-calculator';

import { CreateShopItemFromTemplateDto } from './dto/create-shop-item-from-template.dto';
import { BacklogService } from '../backlog/backlog-service';

@Injectable()
export class ShopItemsService {
  private readonly logger = new Logger(ShopItemsService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(ItemEntity)
    private readonly itemRepository: Repository<ItemEntity>,
    @InjectRepository(ItemCategoryEntity)
    private readonly itemCategoryRepository: Repository<ItemCategoryEntity>,
    @InjectRepository(ItemCategoryLinkEntity)
    private readonly itemCategoryLinkRepository: Repository<ItemCategoryLinkEntity>,
    @InjectRepository(ShopListingEntity)
    private readonly shopListingRepository: Repository<ShopListingEntity>,
    @InjectRepository(ShopListingBadgePromotionEntity)
    private readonly shopListingBadgePromotionRepository: Repository<ShopListingBadgePromotionEntity>,
    @InjectRepository(ShopListingRankPromotionEntity)
    private readonly shopListingRankPromotionRepository: Repository<ShopListingRankPromotionEntity>,
    @InjectRepository(BadgeEntity)
    private readonly badgeRepository: Repository<BadgeEntity>,
    @InjectRepository(EarnedBadgeEntity)
    private readonly earnedBadgeRepository: Repository<EarnedBadgeEntity>,
    @InjectRepository(RankEntity)
    private readonly rankRepository: Repository<RankEntity>,
    @InjectRepository(StudentStatsEntity)
    private readonly studentStatsRepository: Repository<StudentStatsEntity>,
    @InjectRepository(DefaultItemTemplateEntity)
    private readonly templateRepository: Repository<DefaultItemTemplateEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    private readonly backlogService: BacklogService,
    private readonly dataSource: DataSource) {}

  async getItemsForGroup(req: Request, groupId: number, queryAuth?: string) {
    const isLecturer = await this.assertCanReadGroupShop(req, groupId, queryAuth);
    const whereClause: any = { groupId };
    if (!isLecturer) {
      whereClause.isPublished = true;
    }
    const items = await this.itemRepository.find({ where: whereClause });
    if (items.length === 0) return [];
    const listings = await this.shopListingRepository.find({
      where: items.map((i) => ({ itemId: i.id })),
    });

    let earnedBadges: BadgeEntity[] = [];
    let eligibleRanks: RankEntity[] = [];
    let allRanks: RankEntity[] = [];
    let studentTotalEarned = 0;

    if (!isLecturer) {
      const subject = await this.resolveSubject(req, queryAuth);
      const studentAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, STUDENT_ROLE_NAME);
      if (studentAccountId) {
        const enrollment = await this.enrollmentRepository.findOne({ where: { groupId, studentAccountId } });
        if (enrollment) {
          const stats = await this.studentStatsRepository.findOne({ where: { enrollmentId: enrollment.id } });
          studentTotalEarned = stats?.totalEarned ?? 0;
          const earnedBadgeRows = await this.earnedBadgeRepository.find({ where: { enrollmentId: enrollment.id } });
          if (earnedBadgeRows.length > 0) {
            earnedBadges = await this.badgeRepository.findBy({ id: In(earnedBadgeRows.map(e => e.badgeId)) });
          }
        }
      }
      allRanks = await this.rankRepository.find({ where: { groupId } });
      eligibleRanks = allRanks.filter(r => r.requiredPoints <= studentTotalEarned);
    }

    let allBadgePromos: ShopListingBadgePromotionEntity[] = [];
    let allRankPromos: ShopListingRankPromotionEntity[] = [];
    if (listings.length > 0) {
      allBadgePromos = await this.shopListingBadgePromotionRepository.find({
        where: { shopListingId: In(listings.map((listing) => listing.id)) },
      });
      allRankPromos = await this.shopListingRankPromotionRepository.find({
        where: { shopListingId: In(listings.map((listing) => listing.id)) },
      });
    }

    const categoryIdsByItemId = await this.loadCategoryIdsByItemIds(items.map((item) => item.id));

    return items.map((item) => {
      const categoryIds = categoryIdsByItemId.get(item.id) ?? (
        item.categoryId != null ? [item.categoryId] : []
      );
      const listing = listings.find((l) => l.itemId === item.id);
      if (!listing) {
        return { ...item, categoryIds, listing: null };
      }

      const badgePromotions = allBadgePromos.filter((promo) => promo.shopListingId === listing.id);
      const rankPromotions = allRankPromos.filter((promo) => promo.shopListingId === listing.id);

      if (isLecturer) {
        return {
          ...item,
          categoryIds,
          listing: {
            ...listing,
            badgePromotions,
            rankPromotions,
          },
        };
      }

      const rankDiscountedPrice = DiscountCalculator.calculateDiscountedPrice(
        listing.basePrice,
        [],
        eligibleRanks,
        badgePromotions,
        rankPromotions
      );
      const discountedPrice = DiscountCalculator.calculateDiscountedPrice(
        listing.basePrice,
        earnedBadges,
        eligibleRanks,
        badgePromotions,
        rankPromotions
      );
      const isLocked = DiscountCalculator.isItemLocked(item.id, allRanks, studentTotalEarned);

      return {
        ...item,
        categoryIds,
        listing: {
          ...listing,
          rankDiscountedPrice,
          discountedPrice,
          isLocked
        }
      };
    });
  }

  /**
   * Ensures the built-in extra-life shop item exists for a group.
   * Called when a group is created so the product is always the first catalog entry.
   */
  async ensureDefaultExtraLifeItem(groupId: number, manager?: EntityManager): Promise<ItemEntity> {
    const itemRepo = manager ? manager.getRepository(ItemEntity) : this.itemRepository;
    const listingRepo = manager ? manager.getRepository(ShopListingEntity) : this.shopListingRepository;

    const existing = await itemRepo.findOne({ where: { groupId, isExtraLife: true } });
    if (existing) {
      return existing;
    }

    const item = itemRepo.create({
      groupId,
      name: EXTRA_LIFE_ITEM_NAME,
      storyDescription: EXTRA_LIFE_DEFAULT_STORY_DESCRIPTION,
      educationalDescription: EXTRA_LIFE_DEFAULT_EDUCATIONAL_DESCRIPTION,
      imageRef: null,
      categoryId: null,
      isPublished: true,
      isExtraLife: true,
    });
    const savedItem = await itemRepo.save(item);

    const listing = listingRepo.create({
      itemId: savedItem.id,
      basePrice: EXTRA_LIFE_DEFAULT_BASE_PRICE,
      stockQuantity: null,
      perStudentLimit: null,
    });
    await listingRepo.save(listing);

    this.logger.log(`Default extra-life item (id=${savedItem.id}) created for group ${groupId}`);
    return savedItem;
  }

  async createItem(req: Request, groupId: number, dto: CreateShopItemDto) {
    await this.assertLecturerOwnsGroup(req, groupId, dto.auth);

    if (dto.badgePromotions && dto.badgePromotions.length > 0) {
      const badgeIds = dto.badgePromotions.map(bp => bp.id);
      const validBadgesCount = await this.badgeRepository.count({ where: { id: In(badgeIds), groupId } });
      if (validBadgesCount !== badgeIds.length) {
        throw new BadRequestException('One or more badge promotions reference a badge that does not belong to this group');
      }
    }
    if (dto.rankPromotions && dto.rankPromotions.length > 0) {
      const rankIds = dto.rankPromotions.map(rp => rp.id);
      const validRanksCount = await this.rankRepository.count({ where: { id: In(rankIds), groupId } });
      if (validRanksCount !== rankIds.length) {
        throw new BadRequestException('One or more rank promotions reference a rank that does not belong to this group');
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const categoryIds = await this.resolveCategoryIds(groupId, dto.categoryIds, dto.categoryId);
      const item = this.itemRepository.create({
        groupId,
        name: dto.name.trim(),
        storyDescription: dto.storyDescription ?? null,
        educationalDescription: dto.educationalDescription ?? null,
        imageRef: dto.imageRef ?? null,
        categoryId: categoryIds[0] ?? null,
        isPublished: true,
      });

      const savedItem = await queryRunner.manager.save(item);
      await this.syncItemCategoryLinks(queryRunner.manager, savedItem.id, groupId, categoryIds);

      const listing = this.shopListingRepository.create({
        itemId: savedItem.id,
        basePrice: dto.basePrice,
        stockQuantity: dto.stockQuantity ?? null,
        perStudentLimit: dto.perStudentLimit ?? null,
      });

      const savedListing = await queryRunner.manager.save(listing);

      let badgePromotions: ShopListingBadgePromotionEntity[] = [];
      let rankPromotions: ShopListingRankPromotionEntity[] = [];
      
      if (dto.badgePromotions && dto.badgePromotions.length > 0) {
        const promosToSave = dto.badgePromotions.map(bp => this.shopListingBadgePromotionRepository.create({
          shopListingId: savedListing.id,
          badgeId: bp.id,
          promotionType: bp.promotionType,
          value: bp.value
        }));
        badgePromotions = await queryRunner.manager.save(ShopListingBadgePromotionEntity, promosToSave);
      }
      
      if (dto.rankPromotions && dto.rankPromotions.length > 0) {
        const promosToSave = dto.rankPromotions.map(rp => this.shopListingRankPromotionRepository.create({
          shopListingId: savedListing.id,
          rankId: rp.id,
          promotionType: rp.promotionType,
          value: rp.value
        }));
        rankPromotions = await queryRunner.manager.save(ShopListingRankPromotionEntity, promosToSave);
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Shop item "${savedItem.name}" (id=${savedItem.id}) created for group ${groupId}`);

      if (!savedItem.isExtraLife) {
        await this.backlogService.notifyEnrolledStudents(groupId, 'SHOP_ITEM_ADDED', {
          message: `Dodano nowy produkt do sklepu: ${savedItem.name}.`,
          itemId: savedItem.id,
          itemName: savedItem.name,
          basePrice: savedListing.basePrice,
          storyDescription: savedItem.storyDescription ?? null,
          educationalDescription: savedItem.educationalDescription ?? null,
        });
      }

      return {
        ...savedItem,
        categoryIds,
        listing: {
          ...savedListing,
          badgePromotions,
          rankPromotions
        },
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async createItemFromTemplate(req: Request, groupId: number, dto: CreateShopItemFromTemplateDto) {
    await this.assertLecturerOwnsGroup(req, groupId, dto.auth);

    const template = await this.templateRepository.findOne({ where: { id: dto.templateId } });
    if (!template) {
      throw new NotFoundException(`Template with id ${dto.templateId} not found`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const item = this.itemRepository.create({
        groupId,
        name: template.name,
        storyDescription: template.storyDescription,
        educationalDescription: template.educationalDescription,
        categoryId: dto.categoryId ?? null,
        isPublished: true,
      });

      const savedItem = await queryRunner.manager.save(item);

      if (dto.categoryId != null) {
        await this.syncItemCategoryLinks(queryRunner.manager, savedItem.id, groupId, [dto.categoryId]);
      }

      const listing = this.shopListingRepository.create({
        itemId: savedItem.id,
        basePrice: dto.basePrice ?? template.basePrice,
        stockQuantity: dto.stockQuantity ?? null,
        perStudentLimit: dto.perStudentLimit ?? null,
      });

      const savedListing = await queryRunner.manager.save(listing);

      
      await queryRunner.commitTransaction();
      this.logger.log(`Shop item from template (id=${savedItem.id}) created for group ${groupId}`);

      return {
        ...savedItem,
        listing: savedListing,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateItem(req: Request, groupId: number, itemId: number, dto: UpdateShopItemDto) {
    await this.assertLecturerOwnsGroup(req, groupId, dto.auth);

    const item = await this.itemRepository.findOne({ where: { id: itemId, groupId } });
    if (!item) {
      throw new NotFoundException(`Item with id ${itemId} not found in group ${groupId}`);
    }
    const listing = await this.shopListingRepository.findOne({ where: { itemId: item.id } });

    if (dto.badgePromotions && dto.badgePromotions.length > 0) {
      const badgeIds = dto.badgePromotions.map(bp => bp.id);
      const validBadgesCount = await this.badgeRepository.count({ where: { id: In(badgeIds), groupId } });
      if (validBadgesCount !== badgeIds.length) {
        throw new BadRequestException('One or more badge promotions reference a badge that does not belong to this group');
      }
    }
    if (dto.rankPromotions && dto.rankPromotions.length > 0) {
      const rankIds = dto.rankPromotions.map(rp => rp.id);
      const validRanksCount = await this.rankRepository.count({ where: { id: In(rankIds), groupId } });
      if (validRanksCount !== rankIds.length) {
        throw new BadRequestException('One or more rank promotions reference a rank that does not belong to this group');
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (dto.name !== undefined) item.name = dto.name.trim();
      if (dto.storyDescription !== undefined) item.storyDescription = dto.storyDescription;
      if (dto.educationalDescription !== undefined) item.educationalDescription = dto.educationalDescription;
      if (dto.imageRef !== undefined) item.imageRef = dto.imageRef;
      if (dto.categoryId !== undefined || dto.categoryIds !== undefined) {
        const categoryIds = await this.resolveCategoryIds(
          groupId,
          dto.categoryIds,
          dto.categoryId === null ? undefined : dto.categoryId,
          dto.categoryId === null && dto.categoryIds === undefined,
        );
        item.categoryId = categoryIds[0] ?? null;
        await this.syncItemCategoryLinks(queryRunner.manager, item.id, groupId, categoryIds);
      }
      if (dto.isPublished !== undefined) {
        item.isPublished = dto.isPublished;
        item.publishedAt = dto.isPublished ? new Date() : null;
      }

      const savedItem = await queryRunner.manager.save(item);

      let badgePromotions: ShopListingBadgePromotionEntity[] = [];
      let rankPromotions: ShopListingRankPromotionEntity[] = [];
      
      let savedListing = listing;
      if (listing && (dto.basePrice !== undefined || dto.stockQuantity !== undefined || dto.perStudentLimit !== undefined)) {
        if (dto.basePrice !== undefined) listing.basePrice = dto.basePrice;
        if (dto.stockQuantity !== undefined) listing.stockQuantity = dto.stockQuantity;
        if (dto.perStudentLimit !== undefined) listing.perStudentLimit = dto.perStudentLimit;
        savedListing = await queryRunner.manager.save(listing);
      }
      
      if (listing) {
        if (dto.badgePromotions !== undefined) {
           await queryRunner.manager.delete(ShopListingBadgePromotionEntity, { shopListingId: listing.id });
           const promosToSave = dto.badgePromotions.map(bp => this.shopListingBadgePromotionRepository.create({
             shopListingId: listing.id,
             badgeId: bp.id,
             promotionType: bp.promotionType,
             value: bp.value
           }));
           badgePromotions = await queryRunner.manager.save(ShopListingBadgePromotionEntity, promosToSave);
        } else {
           badgePromotions = await this.shopListingBadgePromotionRepository.find({ where: { shopListingId: listing.id } });
        }
        
        if (dto.rankPromotions !== undefined) {
           await queryRunner.manager.delete(ShopListingRankPromotionEntity, { shopListingId: listing.id });
           const promosToSave = dto.rankPromotions.map(rp => this.shopListingRankPromotionRepository.create({
             shopListingId: listing.id,
             rankId: rp.id,
             promotionType: rp.promotionType,
             value: rp.value
           }));
           rankPromotions = await queryRunner.manager.save(ShopListingRankPromotionEntity, promosToSave);
        } else {
           rankPromotions = await this.shopListingRankPromotionRepository.find({ where: { shopListingId: listing.id } });
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Shop item (id=${itemId}) updated in group ${groupId}`);

      return {
        ...savedItem,
        categoryIds: await this.getCategoryIdsForItem(savedItem.id, savedItem.categoryId),
        listing: savedListing ? {
           ...savedListing,
           badgePromotions,
           rankPromotions
        } : null,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteItem(req: Request, groupId: number, itemId: number, bodyAuth?: string) {
    await this.assertLecturerOwnsGroup(req, groupId, bodyAuth);

    const item = await this.itemRepository.findOne({ where: { id: itemId, groupId } });
    if (!item) {
      throw new NotFoundException(`Item with id ${itemId} not found in group ${groupId}`);
    }

    if (item.isExtraLife) {
      throw new BadRequestException('Produkt „Dodatkowe życie” nie może zostać usunięty.');
    }

    await this.itemRepository.remove(item);
    this.logger.log(`Shop item (id=${itemId}) deleted from group ${groupId}`);

    return { deleted: true };
  }

  private async loadCategoryIdsByItemIds(itemIds: number[]): Promise<Map<number, number[]>> {
    const map = new Map<number, number[]>();
    if (itemIds.length === 0) {
      return map;
    }

    const links = await this.itemCategoryLinkRepository.find({
      where: { itemId: In(itemIds) },
      order: { displayOrder: 'ASC', categoryId: 'ASC' },
    });

    for (const link of links) {
      const current = map.get(link.itemId) ?? [];
      current.push(link.categoryId);
      map.set(link.itemId, current);
    }

    return map;
  }

  private async getCategoryIdsForItem(itemId: number, fallbackCategoryId: number | null): Promise<number[]> {
    const links = await this.itemCategoryLinkRepository.find({
      where: { itemId },
      order: { displayOrder: 'ASC', categoryId: 'ASC' },
    });
    if (links.length > 0) {
      return links.map((link) => link.categoryId);
    }
    return fallbackCategoryId != null ? [fallbackCategoryId] : [];
  }

  private async resolveCategoryIds(
    groupId: number,
    categoryIds?: number[],
    categoryId?: number,
    clearCategories = false,
  ): Promise<number[]> {
    if (clearCategories && categoryIds === undefined) {
      return [];
    }

    const resolved = categoryIds?.length
      ? [...new Set(categoryIds)]
      : (categoryId != null ? [categoryId] : []);

    if (resolved.length === 0) {
      return [];
    }

    const validCount = await this.itemCategoryRepository.count({
      where: { id: In(resolved), groupId },
    });
    if (validCount !== resolved.length) {
      throw new BadRequestException('One or more categories do not belong to this group');
    }

    return resolved;
  }

  private async syncItemCategoryLinks(
    manager: EntityManager,
    itemId: number,
    groupId: number,
    categoryIds: number[],
  ): Promise<void> {
    const validatedIds = await this.resolveCategoryIds(groupId, categoryIds);
    await manager.delete(ItemCategoryLinkEntity, { itemId });

    for (let index = 0; index < validatedIds.length; index += 1) {
      const link = manager.create(ItemCategoryLinkEntity, {
        itemId,
        categoryId: validatedIds[index],
        displayOrder: index,
      });
      await manager.save(link);
    }
  }

  private async resolveSubject(req: Request, queryAuth?: string): Promise<SessionSubject> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, queryAuth);
    if (!subject) {
      throw new ForbiddenException('Not authorized');
    }
    return subject;
  }

  private async assertGroupExists(groupId: number): Promise<void> {
    const exists = await this.groupRepository.exist({ where: { id: groupId } });
    if (!exists) {
      throw new NotFoundException(`Group with id ${groupId} not found`);
    }
  }

  private async assertLecturerOwnsGroup(req: Request, groupId: number, queryAuth?: string): Promise<void> {
    const subject = await this.resolveSubject(req, queryAuth);
    const isLecturer = await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME);
    if (!isLecturer) {
      throw new ForbiddenException('Not authorized');
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, LECTURER_ROLE_NAME);
    if (lecturerAccountId === null) {
      throw new ForbiddenException('Not authorized');
    }
    const group = await this.groupRepository.findOne({ where: { id: groupId }, select: ['id', 'teacherAccountId'] });
    if (group === null || group.teacherAccountId !== lecturerAccountId) {
      throw new ForbiddenException('Not authorized');
    }
  }

  private async assertCanReadGroupShop(req: Request, groupId: number, queryAuth?: string): Promise<boolean> {
    const subject = await this.resolveSubject(req, queryAuth);
    await this.assertGroupExists(groupId);
    const group = await this.groupRepository.findOne({ where: { id: groupId }, select: ['id', 'teacherAccountId'] });
    if (group === null) {
      throw new NotFoundException(`Group with id ${groupId} not found`);
    }
    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, LECTURER_ROLE_NAME);
    if (lecturerAccountId !== null && group.teacherAccountId === lecturerAccountId) {
      return true;
    }
    const studentAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, STUDENT_ROLE_NAME);
    if (studentAccountId === null) {
      throw new ForbiddenException('Not authorized');
    }
    const isEnrolled = await this.enrollmentRepository.exist({ where: { groupId, studentAccountId } });
    if (!isEnrolled) {
      throw new ForbiddenException('Not authorized');
    }
    return false;
  }
}
