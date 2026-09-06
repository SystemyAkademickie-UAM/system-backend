import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { Request } from 'express';

import { GroupEntity } from '../database/entities/group.entity';
import { ShopListingEntity } from '../database/entities/shop-listing.entity';
import { ItemEntity } from '../database/entities/item.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { StudentStatsEntity } from '../database/entities/student-stats.entity';
import { EarnedItemEntity } from '../database/entities/earned-item.entity';
import { BacklogEntity } from '../database/entities/backlog.entity';
import { InventoryHistoryItemDto } from './dto/inventory-history.dto';
import { BacklogService } from '../backlog/backlog-service';
import { SessionService } from '../auth/session/session.service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { STUDENT_ROLE_NAME, LECTURER_ROLE_NAME } from '../constants/role-name-constants';

import { ShopListingBadgePromotionEntity } from '../database/entities/shop-listing-badge-promotion.entity';
import { ShopListingRankPromotionEntity } from '../database/entities/shop-listing-rank-promotion.entity';
import { BadgeEntity } from '../database/entities/badge.entity';
import { RankEntity } from '../database/entities/rank.entity';
import { EarnedBadgeEntity } from '../database/entities/earned-badge.entity';
import { DiscountCalculator } from './discount-calculator';


@Injectable()
export class ShopStudentService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
    @InjectRepository(EarnedItemEntity)
    private readonly earnedItemRepository: Repository<EarnedItemEntity>,
    private readonly backlogService: BacklogService,
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService) {}

  private async getStudentAccountId(req: Request, authHeader?: string): Promise<number> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      throw new ForbiddenException('Unauthorized');
    }
    const studentAccountId = await this.userRolesService.findAccountIdForRole(subject.userId, STUDENT_ROLE_NAME);
    if (!studentAccountId) {
      throw new ForbiddenException('Forbidden: Student account not found. You must be a student to use the shop.');
    }
    return studentAccountId;
  }

  async buyItem(
    req: Request,
    internalGroupId: number,
    itemId: number,
    authHeader?: string): Promise<{ success: boolean; message?: string }> {
    const studentAccountId = await this.getStudentAccountId(req);

    return this.dataSource.transaction(async (manager) => {
      // 1. Sprawdzenie czy sklep jest otwarty
      const group = await manager.findOne(GroupEntity, {
        where: { id: internalGroupId },
      });
      if (!group) {
        throw new NotFoundException('Group not found');
      }
      const isShopOpen = group.shopOpen === true || (group.shopOpen as unknown) === 't' || (group.shopOpen as unknown) === 1;
      if (!isShopOpen) {
        throw new ForbiddenException('Sklep grupy jest obecnie zamknięty.');
      }

      // 2. Pobranie przedmiotu i oferty (ShopListing)
      const item = await manager.findOne(ItemEntity, {
        where: { id: itemId, groupId: internalGroupId },
      });
      if (!item) {
        throw new NotFoundException('Item not found in this group catalog');
      }

      const isExtraLife = item.isExtraLife === true;

      const listing = await manager.findOne(ShopListingEntity, {
        where: { itemId: item.id },
      });
      if (!listing) {
        throw new NotFoundException('Item is not listed in the shop');
      }

      // 3. Sprawdzenie Enrollmentu (czy student jest zapisany do grupy)
      const enrollment = await manager.findOne(EnrollmentEntity, {
        where: { groupId: internalGroupId, studentAccountId },
      });
      if (!enrollment) {
        throw new ForbiddenException('Student is not enrolled in this group');
      }

      // 4. Pobranie statystyk studenta (by sprawdzić walutę)
      const stats = await manager.findOne(StudentStatsEntity, {
        where: { enrollmentId: enrollment.id },
      });
      if (!stats) {
        throw new BadRequestException('Student stats not found');
      }
      const currentCurrency = stats.currency || 0;

      if (isExtraLife) {
        const livesEnabled = group.livesEnabled === true || (group.livesEnabled as unknown) === 't' || (group.livesEnabled as unknown) === 1;
        const livesShopEnabled = group.livesShopEnabled === true || (group.livesShopEnabled as unknown) === 't' || (group.livesShopEnabled as unknown) === 1;
        if (!livesEnabled || !livesShopEnabled) {
          throw new ForbiddenException('Kupowanie dodatkowego życia jest wyłączone.');
        }

        const maxLives = group.lives;
        const currentLives = stats.lives ?? 0;
        if (maxLives != null && currentLives >= maxLives) {
          throw new BadRequestException('Osiągnięto maksymalną liczbę żyć. Nie można kupić więcej.');
        }
      }

// Sprawdzenie czy przedmiot jest zablokowany lub ma zniżkę
      const earnedBadgeRows = await manager.find(EarnedBadgeEntity, { where: { enrollmentId: enrollment.id } });
      let earnedBadges: BadgeEntity[] = [];
      if (earnedBadgeRows.length > 0) {
        earnedBadges = await manager.createQueryBuilder(BadgeEntity, 'b')
          .where('b.id IN (:...bIds)', { bIds: earnedBadgeRows.map(e => e.badgeId) })
          .getMany();
      }
      
      const allRanks = await manager.find(RankEntity, { where: { groupId: internalGroupId } });
      const eligibleRanks = allRanks.filter(r => r.requiredPoints <= (stats.totalEarned ?? 0));
      
      const isLocked = DiscountCalculator.isItemLocked(item.id, allRanks, (stats.totalEarned ?? 0));
      if (!isExtraLife && isLocked) {
        throw new ForbiddenException('Przedmiot jest zablokowany. Zdobądź wyższą rangę, aby go odblokować.');
      }
      
      const badgePromotions = await manager.find(ShopListingBadgePromotionEntity, { where: { shopListingId: listing.id } });
      const rankPromotions = await manager.find(ShopListingRankPromotionEntity, { where: { shopListingId: listing.id } });
      
      const price = DiscountCalculator.calculateDiscountedPrice(
         listing.basePrice,
         earnedBadges,
         eligibleRanks,
         badgePromotions,
         rankPromotions
      );
      
      if (currentCurrency < price) {
        throw new BadRequestException('Not enough currency');
      }

      // 5. Sprawdzenie dostępności (stockQuantity)
      if (listing.stockQuantity !== null && listing.stockQuantity !== undefined) {
        if (listing.stockQuantity <= 0) {
          throw new BadRequestException('Przedmiot wyprzedany. Brak sztuk na magazynie.');
        }
      }

      // 6. Pobranie aktualnego ekwipunku studenta (by ew. sprawdzić limit)
      let earnedItem = await manager.findOne(EarnedItemEntity, {
        where: { enrollmentId: enrollment.id, itemId: item.id },
      });
      const currentOwnedQuantity = earnedItem ? earnedItem.quantity : 0;

      if (!isExtraLife && listing.perStudentLimit !== null && listing.perStudentLimit !== undefined) {
        if (currentOwnedQuantity >= listing.perStudentLimit) {
          throw new BadRequestException(`Osiągnięto limit zakupu tego przedmiotu na studenta (${listing.perStudentLimit}).`);
        }
      }

      // 7. ZATWIERDZANIE ZAKUPU
      stats.currency = currentCurrency - price;
      if (isExtraLife) {
        const maxLives = group.lives;
        const currentLives = stats.lives ?? 0;
        stats.lives = maxLives == null
          ? currentLives + 1
          : Math.min(maxLives, currentLives + 1);
      }
      await manager.save(StudentStatsEntity, stats);

      if (listing.stockQuantity !== null && listing.stockQuantity !== undefined) {
        listing.stockQuantity -= 1;
        await manager.save(ShopListingEntity, listing);
      }

      if (!isExtraLife) {
        if (earnedItem) {
          earnedItem.quantity += 1;
        } else {
          earnedItem = manager.create(EarnedItemEntity, {
            enrollmentId: enrollment.id,
            itemId: item.id,
            quantity: 1,
          });
        }
        await manager.save(EarnedItemEntity, earnedItem);
      }

      // Zaloguj zdarzenie w backlogu
      await this.backlogService.logEvent(
        internalGroupId,
        studentAccountId,
        isExtraLife ? 'SHOP_PURCHASE' : 'SHOP_PURCHASE',
        {
          message: isExtraLife
            ? `Kupiono dodatkowe życie za kwotę ${price}.`
            : `Kupiono przedmiot ze sklepu: ${item.name} za kwotę ${price}.`,
          itemId: item.id,
          itemName: item.name,
          price,
          isExtraLife,
        },
        manager,
      );

      return { success: true, message: 'Item purchased successfully' };
    });
  }

  async getInventory(
    req: Request,
    internalGroupId: number,
    authHeader?: string): Promise<any[]> {
    const studentAccountId = await this.getStudentAccountId(req);

    const enrollment = await this.enrollmentRepository.findOne({
      where: { groupId: internalGroupId, studentAccountId },
    });
    if (!enrollment) {
      throw new ForbiddenException('Student is not enrolled in this group');
    }

    const earnedItems = await this.dataSource
      .getRepository(EarnedItemEntity)
      .createQueryBuilder('earned')
      .innerJoinAndMapOne('earned.item', ItemEntity, 'item', 'item.id = earned.item_id')
      .where('earned.enrollment_id = :enrollmentId', { enrollmentId: enrollment.id })
      .andWhere('earned.quantity > 0')
      .getMany();

    return earnedItems;
  }

  async getInventoryForAccount(
    req: Request,
    internalGroupId: number,
    studentAccountId: number): Promise<any[]> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      throw new ForbiddenException('Unauthorized');
    }

    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME,
    );
    if (!lecturerAccountId) {
      throw new ForbiddenException('Forbidden: lecturer access required');
    }

    const enrollment = await this.enrollmentRepository.findOne({
      where: { groupId: internalGroupId, studentAccountId },
    });
    if (!enrollment) {
      throw new NotFoundException('Student is not enrolled in this group');
    }

    const earnedItems = await this.dataSource
      .getRepository(EarnedItemEntity)
      .createQueryBuilder('earned')
      .innerJoinAndMapOne('earned.item', ItemEntity, 'item', 'item.id = earned.item_id')
      .where('earned.enrollment_id = :enrollmentId', { enrollmentId: enrollment.id })
      .andWhere('earned.quantity > 0')
      .getMany();

    return earnedItems;
  }

  private async fetchInventoryHistory(internalGroupId: number, studentAccountId: number): Promise<InventoryHistoryItemDto[]> {
    const records = await this.dataSource.getRepository(BacklogEntity).find({
      where: [
        { groupId: internalGroupId, accountId: studentAccountId, type: 'SHOP_PURCHASE' },
        { groupId: internalGroupId, accountId: studentAccountId, type: 'ITEM_USED' }
      ],
      order: { date: 'DESC' }
    });

    return records.map(record => {
      let parsedValue: Partial<InventoryHistoryItemDto> = {};
      try {
        if (record.value) {
          parsedValue = JSON.parse(record.value) as Partial<InventoryHistoryItemDto>;
        }
      } catch (e) {
        console.warn(`Failed to parse backlog value for record id ${record.id}`);
      }

      return {
        id: record.id,
        type: record.type ?? 'UNKNOWN',
        date: record.date?.toISOString() ?? new Date().toISOString(),
        itemId: parsedValue.itemId ?? 0,
        itemName: parsedValue.itemName,
        price: parsedValue.price,
        isExtraLife: parsedValue.isExtraLife ?? false,
        message: parsedValue.message,
      };
    });
  }

  async getInventoryHistory(
    req: Request,
    internalGroupId: number,
    authHeader?: string): Promise<InventoryHistoryItemDto[]> {
    const studentAccountId = await this.getStudentAccountId(req);

    const enrollment = await this.enrollmentRepository.findOne({
      where: { groupId: internalGroupId, studentAccountId },
    });
    if (!enrollment) {
      throw new ForbiddenException('Student is not enrolled in this group');
    }

    return this.fetchInventoryHistory(internalGroupId, studentAccountId);
  }

  async getInventoryHistoryForAccount(
    req: Request,
    internalGroupId: number,
    studentAccountId: number): Promise<InventoryHistoryItemDto[]> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (!subject) {
      throw new ForbiddenException('Unauthorized');
    }

    const lecturerAccountId = await this.userRolesService.findAccountIdForRole(
      subject.userId,
      LECTURER_ROLE_NAME,
    );
    if (!lecturerAccountId) {
      throw new ForbiddenException('Forbidden: lecturer access required');
    }

    const enrollment = await this.enrollmentRepository.findOne({
      where: { groupId: internalGroupId, studentAccountId },
    });
    if (!enrollment) {
      throw new NotFoundException('Student is not enrolled in this group');
    }

    return this.fetchInventoryHistory(internalGroupId, studentAccountId);
  }

  async useItem(
    req: Request,
    internalGroupId: number,
    itemId: number,
    authHeader?: string): Promise<{ success: boolean; message?: string }> {
    const studentAccountId = await this.getStudentAccountId(req);

    return this.dataSource.transaction(async (manager) => {
      const enrollment = await manager.findOne(EnrollmentEntity, {
        where: { groupId: internalGroupId, studentAccountId },
      });
      if (!enrollment) {
        throw new ForbiddenException('Student is not enrolled in this group');
      }

      const earnedItem = await manager.findOne(EarnedItemEntity, {
        where: { enrollmentId: enrollment.id, itemId },
      });

      if (!earnedItem || earnedItem.quantity <= 0) {
        throw new BadRequestException('You do not own this item or it is depleted');
      }

      const item = await manager.findOne(ItemEntity, {
        where: { id: itemId, groupId: internalGroupId },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      earnedItem.quantity -= 1;
      if (earnedItem.quantity === 0) {
        await manager.remove(EarnedItemEntity, earnedItem);
      } else {
        await manager.save(EarnedItemEntity, earnedItem);
      }

      await this.backlogService.logEvent(
        internalGroupId,
        studentAccountId,
        'ITEM_USED',
        {
          message: `Użyto przedmiotu: ${item.name}.`,
          itemId: item.id,
          itemName: item.name,
        },
        manager,
      );

      return { success: true, message: 'Item used successfully' };
    });
  }
}
