import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from '../database/entities/user.entity';
import { RegistrationService } from './registration.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
