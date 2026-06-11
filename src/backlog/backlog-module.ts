import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { BacklogEntity } from '../database/entities/backlog.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { BacklogController } from './backlog-controller';
import { BacklogService } from './backlog-service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BacklogEntity, GroupEntity, EnrollmentEntity]),
    AuthTokenSessionModule,
    UserRolesModule,
  ],
  controllers: [BacklogController],
  providers: [BacklogService],
  exports: [BacklogService],
})
export class BacklogModule {}
