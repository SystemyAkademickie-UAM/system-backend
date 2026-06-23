import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AvatarEntity } from '../database/entities/avatar.entity';
import { UserEntity } from '../database/entities/user.entity';
import { RegistrationService } from './registration.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, AvatarEntity])],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
