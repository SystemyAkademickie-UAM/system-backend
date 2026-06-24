import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, Repository } from 'typeorm';

import { AuthTokenSessionService, type AuthTokenSubject } from '../auth/api-token/auth-token-session-service';
import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../constants/role-name-constants';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { ItemEntity } from '../database/entities/item.entity';
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

@Injectable()
export class ShopItemsService {
  private readonly logger = new Logger(ShopItemsService.name);

  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(ItemEntity)
    private readonly itemRepository: Repository<ItemEntity>,
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
    private readonly dataSource: DataSource,
  ) {}

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

    return items.map((item) => {
      const listing = listings.find((l) => l.itemId === item.id);
      return {
        ...item,
        listing: listing ?? null,
      };
    });
  }

  async createItem(req: Request, groupId: number, dto: CreateShopItemDto) {
    await this.assertLecturerOwnsGroup(req, groupId, dto.auth);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const item = this.itemRepository.create({
        groupId,
        name: dto.name.trim(),
        storyDescription: dto.storyDescription ?? null,
        educationalDescription: dto.educationalDescription ?? null,
        imageRef: dto.imageRef ?? null,
        categoryId: dto.categoryId ?? null,
      });

      const savedItem = await queryRunner.manager.save(item);

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
        for (const bp of dto.badgePromotions) {
          const promo = this.shopListingBadgePromotionRepository.create({
            shopListingId: savedListing.id,
            badgeId: bp.id,
            promotionType: bp.promotionType,
            value: bp.value
          });
          badgePromotions.push(await queryRunner.manager.save(promo));
        }
      }
      
      if (dto.rankPromotions && dto.rankPromotions.length > 0) {
        for (const rp of dto.rankPromotions) {
          const promo = this.shopListingRankPromotionRepository.create({
            shopListingId: savedListing.id,
            rankId: rp.id,
            promotionType: rp.promotionType,
            value: rp.value
          });
          rankPromotions.push(await queryRunner.manager.save(promo));
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Shop item "${savedItem.name}" (id=${savedItem.id}) created for group ${groupId}`);

      return {
        ...savedItem,
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
      });

      const savedItem = await queryRunner.manager.save(item);

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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (dto.name !== undefined) item.name = dto.name.trim();
      if (dto.storyDescription !== undefined) item.storyDescription = dto.storyDescription;
      if (dto.educationalDescription !== undefined) item.educationalDescription = dto.educationalDescription;
      if (dto.imageRef !== undefined) item.imageRef = dto.imageRef;
      if (dto.categoryId !== undefined) item.categoryId = dto.categoryId;
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
           for (const bp of dto.badgePromotions) {
              const promo = this.shopListingBadgePromotionRepository.create({
                shopListingId: listing.id,
                badgeId: bp.id,
                promotionType: bp.promotionType,
                value: bp.value
              });
              badgePromotions.push(await queryRunner.manager.save(promo));
           }
        } else {
           badgePromotions = await this.shopListingBadgePromotionRepository.find({ where: { shopListingId: listing.id } });
        }
        
        if (dto.rankPromotions !== undefined) {
           await queryRunner.manager.delete(ShopListingRankPromotionEntity, { shopListingId: listing.id });
           for (const rp of dto.rankPromotions) {
              const promo = this.shopListingRankPromotionRepository.create({
                shopListingId: listing.id,
                rankId: rp.id,
                promotionType: rp.promotionType,
                value: rp.value
              });
              rankPromotions.push(await queryRunner.manager.save(promo));
           }
        } else {
           rankPromotions = await this.shopListingRankPromotionRepository.find({ where: { shopListingId: listing.id } });
        }
      }

      await queryRunner.commitTransaction();
      this.logger.log(`Shop item (id=${itemId}) updated in group ${groupId}`);

      return {
        ...savedItem,
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

    await this.itemRepository.remove(item);
    this.logger.log(`Shop item (id=${itemId}) deleted from group ${groupId}`);

    return { deleted: true };
  }

  private async resolveSubject(req: Request, queryAuth?: string): Promise<AuthTokenSubject> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, queryAuth);
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
