import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { GroupsEnrollmentService } from './groups-enrollment-service';
import { GroupsController } from './groups-controller';
import { GroupsService } from './groups-service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupEntity, EnrollmentEntity]),
    AuthTokenSessionModule,
    UserRolesModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService, GroupsEnrollmentService],
})
export class GroupsModule {}
