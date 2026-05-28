import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { AvatarEntity } from '../database/entities/avatar.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ProfileController } from './profile-controller';
import { ProfileService } from './profile-service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, AvatarEntity]),
    AuthTokenSessionModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
