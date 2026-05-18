import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { StudentProfileController } from './student-profile-controller';
import { StudentProfileService } from './student-profile-service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EnrollmentEntity, GroupEntity]),
    AuthTokenSessionModule,
    UserRolesModule,
  ],
  controllers: [StudentProfileController],
  providers: [StudentProfileService],
})
export class StudentProfileModule {}
