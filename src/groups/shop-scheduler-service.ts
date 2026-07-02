import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { BacklogService } from '../backlog/backlog-service';
import { GroupEntity } from '../database/entities/group.entity';

@Injectable()
export class ShopSchedulerService {
  private readonly logger = new Logger(ShopSchedulerService.name);

  constructor(
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    private readonly backlogService: BacklogService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleShopOpenings() {
    try {
      const now = new Date();
      const groupsToOpen = await this.groupRepository.find({
        where: {
          shopOpen: false,
          shopOpensAt: LessThanOrEqual(now),
        },
        select: ['id'],
      });

      if (groupsToOpen.length === 0) {
        return;
      }

      const result = await this.groupRepository.update(
        {
          shopOpen: false,
          shopOpensAt: LessThanOrEqual(now),
        },
        {
          shopOpen: true,
          shopOpensAt: null,
        },
      );

      const affected = result.affected ?? 0;
      if (affected > 0) {
        this.logger.log(`Successfully opened ${affected} shops.`);
        await Promise.all(
          groupsToOpen.map((group) => this.backlogService.notifyEnrolledStudents(
            group.id,
            'SHOP_STATUS_CHANGED',
            {
              message: 'Sklep grupy został otwarty.',
              shopOpen: true,
            },
          )),
        );
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to handle shop openings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
