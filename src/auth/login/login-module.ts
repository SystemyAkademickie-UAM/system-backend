import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { AuthTokenSessionModule } from '../api-token/auth-token-session-module';
import { SamlModule } from '../saml/saml.module';
import { LoginController } from './login-controller';
import { LogoutController } from './logout-controller';
import { LoginApiService } from './login-api.service';
import { SamlBypassController } from './saml-bypass.controller';
import { SamlBypassService } from './saml-bypass.service';
import { SamlLinkedUserService } from './saml-linked-user.service';

@Module({
  imports: [TypeOrmModule.forFeature([AccountEntity, OrganizationEntity]), AuthTokenSessionModule, SamlModule],
  controllers: [LoginController, LogoutController, SamlBypassController],
  providers: [LoginApiService, SamlLinkedUserService, SamlBypassService],
})
export class LoginModule {}
