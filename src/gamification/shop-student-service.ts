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
import { BacklogService } from '../backlog/backlog-service';
import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { UserRolesService } from '../user-roles/user-roles-service';
import { STUDENT_ROLE_NAME } from '../constants/role-name-constants';

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
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
  ) {}

  private async getStudentAccountId(req: Request, authHeader?: string): Promise<number> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, authHeader);
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
    authHeader?: string,
  ): Promise<{ success: boolean; message?: string }> {
    const studentAccountId = await this.getStudentAccountId(req, authHeader);

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

      // Sprawdzenie czy studenta stać na ten przedmiot
      const price = listing.basePrice;
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

      if (listing.perStudentLimit !== null && listing.perStudentLimit !== undefined) {
        if (currentOwnedQuantity >= listing.perStudentLimit) {
          throw new BadRequestException(`Osiągnięto limit zakupu tego przedmiotu na studenta (${listing.perStudentLimit}).`);
        }
      }

      // 7. ZATWIERDZANIE ZAKUPU
      stats.currency = currentCurrency - price;
      await manager.save(StudentStatsEntity, stats);

      if (listing.stockQuantity !== null && listing.stockQuantity !== undefined) {
        listing.stockQuantity -= 1;
        await manager.save(ShopListingEntity, listing);
      }

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

      // Zaloguj zdarzenie w backlogu
      await this.backlogService.logEvent(
        internalGroupId,
        studentAccountId,
        'SHOP_PURCHASE',
        `Kupiono przedmiot ze sklepu: ${item.name} za kwotę ${price}.`,
        manager
      );

      return { success: true, message: 'Item purchased successfully' };
    });
  }

  async getInventory(
    req: Request,
    internalGroupId: number,
    authHeader?: string,
  ): Promise<any[]> {
    const studentAccountId = await this.getStudentAccountId(req, authHeader);

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

  async useItem(
    req: Request,
    internalGroupId: number,
    itemId: number,
    authHeader?: string,
  ): Promise<{ success: boolean; message?: string }> {
    const studentAccountId = await this.getStudentAccountId(req, authHeader);

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
        `Użyto przedmiotu: ${item.name}.`,
        manager
      );

      return { success: true, message: 'Item used successfully' };
    });
  }
}
