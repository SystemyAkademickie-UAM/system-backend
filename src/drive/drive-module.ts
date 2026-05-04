import { Module } from '@nestjs/common';

import { LecturerAuthModule } from '../lecturer-auth/lecturer-auth-module';
import { DriveController } from './drive-controller';
import { DriveService } from './drive-service';

@Module({
  imports: [LecturerAuthModule],
  controllers: [DriveController],
  providers: [DriveService],
})
export class DriveModule {}
