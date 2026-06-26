import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { EnrollmentCodeEntity } from '../database/entities/enrollment-code.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { GroupTemplateEntity } from '../database/entities/group-template.entity';
import { GroupTemplateFavoriteEntity } from '../database/entities/group-template-favorite.entity';
import { PostEntity } from '../database/entities/post.entity';
import { StudentStatsEntity } from '../database/entities/student-stats.entity';
import { GamificationModule } from '../gamification/gamification-module';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { GroupsEnrollmentService } from './groups-enrollment-service';
import { EnrollmentCodesService } from './enrollment-codes-service';
import { GroupsController } from './groups-controller';
import { GroupsService } from './groups-service';
import { GroupsPostsController } from './groups-posts-controller';
import { GroupsPostsService } from './groups-posts-service';
import { GroupsCurrencyController } from './groups-currency-controller';
import { GroupsCurrencyService } from './groups-currency-service';
import { GroupTemplatesController } from './group-templates/group-templates-controller';
import { GroupTemplatesCrudController } from './group-templates/group-templates-crud-controller';
import { GroupTemplatesCrudService } from './group-templates/group-templates-crud-service';
import { GroupTemplatesExportService } from './group-templates/group-templates-export-service';
import { GroupTemplatesImportService } from './group-templates/group-templates-import-service';
import { ShopSchedulerService } from './shop-scheduler-service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GroupEntity,
      EnrollmentEntity,
      EnrollmentCodeEntity,
      PostEntity,
      StudentStatsEntity,
      GroupTemplateEntity,
      GroupTemplateFavoriteEntity,
    ]),
    AuthTokenSessionModule,
    UserRolesModule,
    GamificationModule,
  ],
  controllers: [
    GroupsController,
    GroupsPostsController,
    GroupsCurrencyController,
    GroupTemplatesController,
    GroupTemplatesCrudController,
  ],
  providers: [
    GroupsService,
    GroupsEnrollmentService,
    EnrollmentCodesService,
    GroupsPostsService,
    GroupsCurrencyService,
    GroupTemplatesExportService,
    GroupTemplatesImportService,
    GroupTemplatesCrudService,
    ShopSchedulerService,
  ],
})
export class GroupsModule {}
