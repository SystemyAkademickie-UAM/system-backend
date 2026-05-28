import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { ActivityBacklogEntity } from '../database/entities/activity-backlog.entity';
import { ActivityEntity } from '../database/entities/activity.entity';
import { BadgeEntity } from '../database/entities/badge.entity';
import { EarnedBadgeEntity } from '../database/entities/earned-badge.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { StageEntity } from '../database/entities/stage.entity';
import { StudentStatsEntity } from '../database/entities/student-stats.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { GamificationModule } from '../gamification/gamification-module';
import { StudentBadgesService } from './student-badges-service';
import { StudentManagementController } from './student-management-controller';
import { StudentManagementService } from './student-management-service';
import { StudentProgressService } from './student-progress-service';

/**
 * Participant management module – lecturer-facing panel for
 * student list, badges, and progress management.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EnrollmentEntity,
      StudentStatsEntity,
      EarnedBadgeEntity,
      BadgeEntity,
      ActivityBacklogEntity,
      StageEntity,
      ActivityEntity,
      GroupEntity,
    ]),
    AuthTokenSessionModule,
    UserRolesModule,
    GamificationModule,
  ],
  controllers: [StudentManagementController],
  providers: [StudentManagementService, StudentBadgesService, StudentProgressService],
})
export class StudentManagementModule {}
