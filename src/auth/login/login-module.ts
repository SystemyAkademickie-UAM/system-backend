import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SuperAdminBootstrapModule } from '../../admin/bootstrap/super-admin-bootstrap.module';
import { AccountEntity } from '../../database/entities/account.entity';
import { MagicLinkTokenEntity } from '../../database/entities/magic-link-token.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { RegistrationModule } from '../../registration/registration.module';
import { UserRolesModule } from '../../user-roles/user-roles-module';
import { AuthTokenSessionModule } from '../api-token/auth-token-session-module';
import { OrganizationLoginModule } from '../organization-login/organization-login.module';
import { MagicLinkEmailService } from '../magic-link/magic-link-email.service';
import { MagicLinkUserService } from '../magic-link/magic-link-user.service';
import { MagicLinkService } from '../magic-link/magic-link.service';
import { SamlModule } from '../saml/saml.module';
import { LoginController } from './login-controller';
import { LogoutController } from './logout-controller';
import { LoginApiService } from './login-api.service';
import { SamlLinkedUserService } from './saml-linked-user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntity,
      MagicLinkTokenEntity,
      OrganizationEntity,
      UserEntity,
    ]),
    AuthTokenSessionModule,
    UserRolesModule,
    SuperAdminBootstrapModule,
    OrganizationLoginModule,
    forwardRef(() => SamlModule),
    RegistrationModule,
  ],
  controllers: [LoginController, LogoutController],
  providers: [
    LoginApiService,
    SamlLinkedUserService,
    MagicLinkService,
    MagicLinkEmailService,
    MagicLinkUserService,
  ],
  exports: [LoginApiService],
})
export class LoginModule {}
