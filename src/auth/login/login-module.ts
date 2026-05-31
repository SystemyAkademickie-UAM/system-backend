import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { RegistrationModule } from '../../registration/registration.module';
import { UserRolesModule } from '../../user-roles/user-roles-module';
import { AuthTokenSessionModule } from '../api-token/auth-token-session-module';
import { SamlModule } from '../saml/saml.module';
import { LoginController } from './login-controller';
import { LogoutController } from './logout-controller';
import { LoginApiService } from './login-api.service';
import { SamlLinkedUserService } from './saml-linked-user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountEntity, OrganizationEntity, UserEntity]),
    AuthTokenSessionModule,
    UserRolesModule,
    forwardRef(() => SamlModule),
    RegistrationModule,
  ],
  controllers: [LoginController, LogoutController],
  providers: [LoginApiService, SamlLinkedUserService],
  exports: [LoginApiService],
})
export class LoginModule {}
