import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { SessionModule } from '../auth/session/session.module';
import { AccountEntity } from '../database/entities/account.entity';
import { IdpCertificateEntity } from '../database/entities/idp-certificate.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { UserEntity } from '../database/entities/user.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { AdminAccessService } from './admin-access.service';
import { AccountRemovalService } from './accounts/account-removal.service';
import { AdminManageableOrganizationsController } from './accounts/admin-manageable-organizations.controller';
import { AdminOrganizationAccountsController } from './accounts/admin-organization-accounts.controller';
import { AdminOrganizationAccountsService } from './accounts/admin-organization-accounts.service';
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
    SessionModule,
    UserRolesModule,
    SuperAdminBootstrapModule,
  ],
  controllers: [
    AdminOrganizationsController,
    AdminOrganizationAdministratorsController,
    AdminManageableOrganizationsController,
    AdminOrganizationAccountsController,
  ],
  providers: [
    AdminAccessService,
    AdminOrganizationsService,
    AdminOrganizationAdministratorsService,
    AdminOrganizationAccountsService,
    AccountRemovalService,
  ],
})
export class AdminModule {}
