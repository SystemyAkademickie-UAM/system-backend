import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountEntity } from '../database/entities/account.entity';
import { UserRolesService } from './user-roles-service';

@Module({
  imports: [TypeOrmModule.forFeature([AccountEntity])],
  providers: [UserRolesService],
  exports: [UserRolesService],
})
export class UserRolesModule {}
