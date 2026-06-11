import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { AccountEntity } from '../database/entities/account.entity';
import { IdpCertificateEntity } from '../database/entities/idp-certificate.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { UserEntity } from '../database/entities/user.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { AdminAccessService } from './admin-access.service';
import { SuperAdminBootstrapModule } from './bootstrap/super-admin-bootstrap.module';
import { AdminOrganizationAdministratorsController } from './organizations/admin-organization-administrators.controller';
import { AdminOrganizationAdministratorsService } from './organizations/admin-organization-administrators.service';
import { AdminOrganizationsController } from './organizations/admin-organizations.controller';
import { AdminOrganizationsService } from './organizations/admin-organizations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationEntity,
      IdpCertificateEntity,
      AccountEntity,
      UserEntity,
    ]),
    AuthTokenSessionModule,
    UserRolesModule,
    SuperAdminBootstrapModule,
  ],
  controllers: [AdminOrganizationsController, AdminOrganizationAdministratorsController],
  providers: [AdminAccessService, AdminOrganizationsService, AdminOrganizationAdministratorsService],
})
export class AdminModule {}
