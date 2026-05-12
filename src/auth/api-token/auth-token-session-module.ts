import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenEntity } from '../../database/entities/auth-token.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthTokenHmacService } from './auth-token-hmac.service';
import { AuthTokenIssuanceService } from './auth-token-issuance.service';
import { AuthTokenSessionService } from './auth-token-session-service';

@Module({
  imports: [TypeOrmModule.forFeature([AuthTokenEntity, UserEntity])],
  providers: [
    AuthTokenSessionService,
    AuthTokenIssuanceService,
    AuthTokenHmacService,
  ],
  exports: [
    TypeOrmModule,
    AuthTokenSessionService,
    AuthTokenIssuanceService,
    AuthTokenHmacService,
  ],
})
export class AuthTokenSessionModule {}
