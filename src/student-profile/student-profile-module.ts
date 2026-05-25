import { Module } from '@nestjs/common';
import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { StudentProfileController } from './student-profile-controller';
import { StudentProfileService } from './student-profile-service';

@Module({
  imports: [
    AuthTokenSessionModule,
    UserRolesModule,
  ],
  controllers: [StudentProfileController],
  providers: [StudentProfileService],
})
export class StudentProfileModule {}
