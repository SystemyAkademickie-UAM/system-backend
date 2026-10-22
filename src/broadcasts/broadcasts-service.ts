import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  BROADCAST_DEFAULT_LEVEL,
  BROADCAST_LIST_DEFAULT_TAKE,
  BROADCAST_LIST_MAX_TAKE,
  BROADCAST_TARGET_ALL,
  BROADCAST_USER_FEED_MAX_TAKE,
} from '../constants/broadcast-constants';
import { BroadcastEntity } from '../database/entities/broadcast.entity';
import { UserBroadcastStatusEntity } from '../database/entities/user-broadcast-status.entity';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import type {
  BroadcastListResponse,
  BroadcastResponse,
} from './broadcast-response-types';

/**
 * Domain service managing platform-wide announcements.
 */
@Injectable()
export class BroadcastsService {
  constructor(
    @InjectRepository(BroadcastEntity)
    private readonly broadcastRepository: Repository<BroadcastEntity>,
    @InjectRepository(UserBroadcastStatusEntity)
    private readonly statusRepository: Repository<UserBroadcastStatusEntity>,
  ) {}

  /**
   * Creates a new broadcast announcement.
   */
  async createBroadcast(
    dto: CreateBroadcastDto,
    superAdminUserId: number,
  ): Promise<BroadcastResponse> {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid expiresAt date format');
    }

    const entity = this.broadcastRepository.create({
      title: dto.title.trim(),
      content: dto.content.trim(),
      level: dto.level ?? BROADCAST_DEFAULT_LEVEL,
      targetRole: dto.targetRole ?? BROADCAST_TARGET_ALL,
      expiresAt,
      createdByUserId: superAdminUserId,
    });

    const saved = await this.broadcastRepository.save(entity);
    return this.mapBroadcast(saved);
  }

  /**
   * Deletes a broadcast announcement by its primary key.
   */
  async deleteBroadcast(broadcastId: number): Promise<{ deleted: boolean }> {
    const result = await this.broadcastRepository.delete({ id: broadcastId });
    if (!result.affected || result.affected === 0) {
      throw new NotFoundException(`Broadcast with id ${broadcastId} not found`);
    }
    return { deleted: true };
  }

  /**
   * Lists all broadcast announcements for administrators with pagination.
   */
  async listAdminBroadcasts(
    takeRaw?: number,
    skipRaw?: number,
  ): Promise<BroadcastListResponse> {
    const takeInput = takeRaw !== undefined && Number.isFinite(takeRaw)
      ? takeRaw
      : BROADCAST_LIST_DEFAULT_TAKE;
    const skipInput = skipRaw !== undefined && Number.isFinite(skipRaw) ? skipRaw : 0;
    const take = Math.max(1, Math.min(takeInput, BROADCAST_LIST_MAX_TAKE));
    const skip = Math.max(0, skipInput);

    const [rows, total] = await this.broadcastRepository.findAndCount({
      order: { createdAt: 'DESC' },
      take,
      skip,
    });

    return {
      items: rows.map((b) => this.mapBroadcast(b)),
      total,
    };
  }

  /**
   * Retrieves active, unread broadcasts matching the user's roles.
   * Model: Fan-out on read — queries `services.broadcasts` excluding already read entries.
   */
  async listActiveForUser(
    userId: number,
    userRoles: string[],
  ): Promise<BroadcastResponse[]> {
    const roles = Array.from(new Set([BROADCAST_TARGET_ALL, ...userRoles]));
    const now = new Date();

    const qb = this.broadcastRepository
      .createQueryBuilder('b')
      .where('b.target_role IN (:...roles)', { roles })
      .andWhere('(b.expires_at IS NULL OR b.expires_at > :now)', { now })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM services.user_broadcast_status ubs
          WHERE ubs.broadcast_id = b.id AND ubs.user_id = :userId
        )`,
        { userId },
      )
      .orderBy('b.created_at', 'DESC')
      .take(BROADCAST_USER_FEED_MAX_TAKE);

    const rows = await qb.getMany();
    return rows.map((b) => this.mapBroadcast(b));
  }

  /**
   * Marks a broadcast as read for the user, inserting a read receipt idempotently.
   */
  async markAsRead(
    userId: number,
    broadcastId: number,
  ): Promise<{ read: boolean }> {
    const exists = await this.broadcastRepository.exist({ where: { id: broadcastId } });
    if (!exists) {
      throw new NotFoundException(`Broadcast with id ${broadcastId} not found`);
    }

    await this.statusRepository
      .createQueryBuilder()
      .insert()
      .into(UserBroadcastStatusEntity)
      .values({
        userId,
        broadcastId,
        readAt: new Date(),
      })
      .orIgnore()
      .execute();

    return { read: true };
  }

  private mapBroadcast(b: BroadcastEntity): BroadcastResponse {
    return {
      id: b.id,
      title: b.title,
      content: b.content,
      level: b.level,
      targetRole: b.targetRole,
      expiresAt: b.expiresAt instanceof Date ? b.expiresAt.toISOString() : null,
      createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : new Date().toISOString(),
    };
  }
}
