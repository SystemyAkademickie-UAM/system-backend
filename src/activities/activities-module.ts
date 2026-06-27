import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { ActivityBacklogEntity } from '../database/entities/activity-backlog.entity';
import { ActivityEntity } from '../database/entities/activity.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { StageEntity } from '../database/entities/stage.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { GroupAuthorizationModule } from '../groups/group-authorization.module';
import { ActivitiesController } from './activities-controller';
import { ActivitiesService } from './activities-service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActivityEntity, StageEntity, GroupEntity, ActivityBacklogEntity]),
    AuthTokenSessionModule,
    UserRolesModule,
    GroupAuthorizationModule,
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
