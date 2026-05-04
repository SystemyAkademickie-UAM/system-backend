import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenEntity } from '../database/entities/auth-token.entity';
import { UserEntity } from '../database/entities/user.entity';
import { UserRoleEntity } from '../database/entities/user-role.entity';
import { LecturerSessionAuthService } from './lecturer-session-auth-service';

@Module({
  imports: [TypeOrmModule.forFeature([AuthTokenEntity, UserEntity, UserRoleEntity])],
  providers: [LecturerSessionAuthService],
  exports: [LecturerSessionAuthService],
})
export class LecturerAuthModule {}
