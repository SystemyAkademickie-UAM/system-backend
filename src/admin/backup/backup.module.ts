import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';

import { SessionModule } from '../../auth/session/session.module';
import { UserRolesModule } from '../../user-roles/user-roles-module';
import { AdminAccessService } from '../admin-access.service';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  imports: [
    ConfigModule,
    SessionModule,
    UserRolesModule,
    MulterModule.register({
      storage: undefined, // memory storage (default)
    }),
  ],
  controllers: [BackupController],
  providers: [AdminAccessService, BackupService],
})
export class BackupModule {}
