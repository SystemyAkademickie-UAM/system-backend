import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SamlModule } from './auth/saml/saml.module';
import { CounterModule } from './counter/counter-module';
import { DatabaseModule } from './database/database-module';
import { LoginModule } from './auth/login/login-module';
import { DriveModule } from './drive/drive-module';
import { GamificationModule } from './gamification/gamification-module';
import { StudentProfileModule } from './student-profile/student-profile-module';
import { GroupsModule } from './groups/groups-module';
import { StagesModule } from './stages/stages-module';
import { ActivitiesModule } from './activities/activities-module';
import { StudentManagementModule } from './student-management/student-management-module';
import { ProfileModule } from './profile/profile-module';
import { AdminModule } from './admin/admin-module';
import { BannersModule } from './banners/banners-module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SamlModule,
    LoginModule,
    AdminModule,
    CounterModule,
    GamificationModule,
    GroupsModule,
    StagesModule,
    ActivitiesModule,
    DriveModule,
    StudentProfileModule,
    StudentManagementModule,
    ProfileModule,
    BannersModule,
  ],
})
export class AppModule {}
