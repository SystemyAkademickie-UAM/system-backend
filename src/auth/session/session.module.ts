import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SessionEntity } from '../../database/entities/session.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SessionHmacService } from './session-hmac.service';
import { SessionIssuanceService } from './session-issuance.service';
import { SessionService } from './session.service';

@Module({
  imports: [TypeOrmModule.forFeature([SessionEntity, UserEntity])],
  providers: [SessionService, SessionIssuanceService, SessionHmacService],
  exports: [TypeOrmModule, SessionService, SessionIssuanceService, SessionHmacService],
})
export class SessionModule {}
