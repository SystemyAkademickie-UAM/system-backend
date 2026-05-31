import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { IdpCertificateEntity } from '../database/entities/idp-certificate.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { AdminOrganizationsController } from './organizations/admin-organizations.controller';
import { AdminOrganizationsService } from './organizations/admin-organizations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrganizationEntity, IdpCertificateEntity]),
    AuthTokenSessionModule,
    UserRolesModule,
  ],
  controllers: [AdminOrganizationsController],
  providers: [AdminOrganizationsService],
})
export class AdminModule {}
