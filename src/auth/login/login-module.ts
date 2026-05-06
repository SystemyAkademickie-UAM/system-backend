import { Module } from '@nestjs/common';

import { AuthTokenSessionModule } from '../api-token/auth-token-session-module';
import { SamlAuthModule } from '../saml/saml-auth.module';
import { LoginController } from './login-controller';
import { LoginApiService } from './login-api.service';
import { SamlLinkedUserService } from './saml-linked-user.service';

@Module({
  imports: [AuthTokenSessionModule, SamlAuthModule],
  controllers: [LoginController],
  providers: [LoginApiService, SamlLinkedUserService],
})
export class LoginModule {}
