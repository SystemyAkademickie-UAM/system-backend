import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SamlModule } from './auth/saml/saml.module';
import { CounterModule } from './counter/counter-module';
import { DatabaseModule } from './database/database-module';
import { LoginModule } from './auth/login/login-module';
import { DriveModule } from './drive/drive-module';
import { GroupsModule } from './groups/groups-module';
import { StudentProfileModule } from './student-profile/student-profile-module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SamlModule,
    LoginModule,
    CounterModule,
    GroupsModule,
    DriveModule,
    StudentProfileModule,
  ],
})
export class AppModule {}
