import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from '../database/entities/user.entity';
import { UserRoleEntity } from '../database/entities/user-role.entity';
import { UserRolesService } from './user-roles-service';

@Module({
  imports: [TypeOrmModule.forFeature([UserRoleEntity, UserEntity])],
  providers: [UserRolesService],
  exports: [UserRolesService],
})
export class UserRolesModule {}
