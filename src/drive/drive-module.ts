import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { DriveEntity } from '../database/entities/drive.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { OrganizationLogModule } from '../organization-log/organization-log.module';
import { DriveController } from './drive-controller';
import { DriveService } from './drive-service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriveEntity]),
    AuthTokenSessionModule,
    UserRolesModule,
    OrganizationLogModule,
  ],
  controllers: [DriveController],
  providers: [DriveService],
  exports: [DriveService],
})
export class DriveModule {}
