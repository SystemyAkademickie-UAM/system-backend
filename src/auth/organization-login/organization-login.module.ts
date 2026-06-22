import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OrganizationEntity } from '../../database/entities/organization.entity';
import { OrganizationLoginService } from './organization-login.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizationEntity])],
  providers: [OrganizationLoginService],
  exports: [OrganizationLoginService],
})
export class OrganizationLoginModule {}
