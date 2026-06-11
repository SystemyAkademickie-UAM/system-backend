import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SuperAdminBootstrapService } from './super-admin-bootstrap.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccountEntity, UserEntity, OrganizationEntity])],
  providers: [SuperAdminBootstrapService],
  exports: [SuperAdminBootstrapService],
})
export class SuperAdminBootstrapModule {}
