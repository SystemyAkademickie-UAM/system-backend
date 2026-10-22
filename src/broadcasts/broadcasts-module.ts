import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SessionModule } from '../auth/session/session.module';
import { BroadcastEntity } from '../database/entities/broadcast.entity';
import { UserBroadcastStatusEntity } from '../database/entities/user-broadcast-status.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { AdminBroadcastsController } from './admin-broadcasts-controller';
import { BroadcastAccessService } from './broadcast-access-service';
import { BroadcastsService } from './broadcasts-service';
import { UserBroadcastsController } from './user-broadcasts-controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BroadcastEntity,
      UserBroadcastStatusEntity,
    ]),
    SessionModule,
    UserRolesModule,
  ],
  controllers: [
    AdminBroadcastsController,
    UserBroadcastsController,
  ],
  providers: [
    BroadcastsService,
    BroadcastAccessService,
  ],
  exports: [
    BroadcastsService,
    BroadcastAccessService,
  ],
})
export class BroadcastsModule {}
