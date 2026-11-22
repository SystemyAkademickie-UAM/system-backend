import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { LoginModule } from '../auth/login/login-module';
import { SessionModule } from '../auth/session/session.module';
import { AccountEntity } from '../database/entities/account.entity';
import { DriveEntity } from '../database/entities/drive.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { IdpCertificateEntity } from '../database/entities/idp-certificate.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { OrganizationLogEntity } from '../database/entities/organization-log.entity';
import { UserEntity } from '../database/entities/user.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { AdminAccessService } from './admin-access.service';
import { AccountRemovalService } from './accounts/account-removal.service';
import { AdminOrganizationAccountRosterService } from './accounts/admin-organization-account-roster.service';
import { AdminManageableOrganizationsController } from './accounts/admin-manageable-organizations.controller';
import { AdminOrganizationAccountsController } from './accounts/admin-organization-accounts.controller';
import { AdminOrganizationAccountsService } from './accounts/admin-organization-accounts.service';
import { OrganizationLogModule } from '../organization-log/organization-log.module';
import { SuperAdminBootstrapModule } from './bootstrap/super-admin-bootstrap.module';
import { AdminOrganizationAdministratorsController } from './organizations/admin-organization-administrators.controller';
import { AdminOrganizationAdministratorsService } from './organizations/admin-organization-administrators.service';
import { AdminOrganizationsController } from './organizations/admin-organizations.controller';
import { AdminOrganizationsService } from './organizations/admin-organizations.service';
import { AdminOrganizationStorageController } from './storage/admin-organization-storage.controller';
import { AdminOrganizationStorageService } from './storage/admin-organization-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationEntity,
      IdpCertificateEntity,
      AccountEntity,
      UserEntity,
      GroupEntity,
      DriveEntity,
      OrganizationLogEntity,
    ]),
    AuthTokenSessionModule,
    LoginModule,
    SessionModule,
    UserRolesModule,
    SuperAdminBootstrapModule,
    OrganizationLogModule,
  ],
  controllers: [
    AdminOrganizationsController,
    AdminOrganizationAdministratorsController,
    AdminManageableOrganizationsController,
    AdminOrganizationAccountsController,
    AdminOrganizationStorageController,
  ],
  providers: [
    AdminAccessService,
    AdminOrganizationsService,
    AdminOrganizationAdministratorsService,
    AdminOrganizationAccountsService,
    AdminOrganizationAccountRosterService,
    AccountRemovalService,
    AdminOrganizationStorageService,
  ],
})
export class AdminModule {}
