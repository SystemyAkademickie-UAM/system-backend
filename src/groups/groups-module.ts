import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { PostEntity } from '../database/entities/post.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { GroupsEnrollmentService } from './groups-enrollment-service';
import { GroupsController } from './groups-controller';
import { GroupsService } from './groups-service';
import { GroupsPostsController } from './groups-posts-controller';
import { GroupsPostsService } from './groups-posts-service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupEntity, EnrollmentEntity, PostEntity]),
    AuthTokenSessionModule,
    UserRolesModule,
  ],
  controllers: [GroupsController, GroupsPostsController],
  providers: [GroupsService, GroupsEnrollmentService, GroupsPostsService],
})
export class GroupsModule {}

