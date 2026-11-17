import { Module } from '@nestjs/common';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { OrganizationLogModule } from '../organization-log/organization-log.module';
import { DriveController } from './drive-controller';
import { DriveService } from './drive-service';

@Module({
  imports: [AuthTokenSessionModule, UserRolesModule, OrganizationLogModule],
  controllers: [DriveController],
  providers: [DriveService],
})
export class DriveModule {}
