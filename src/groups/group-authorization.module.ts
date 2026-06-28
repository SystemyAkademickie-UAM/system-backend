import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { GroupEntity } from '../database/entities/group.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { GroupAuthorizationService } from './group-authorization.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupEntity]),
    AuthTokenSessionModule,
    UserRolesModule,
  ],
  providers: [GroupAuthorizationService],
  exports: [GroupAuthorizationService],
})
export class GroupAuthorizationModule {}
