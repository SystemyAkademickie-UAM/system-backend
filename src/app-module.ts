import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SamlModule } from './auth/saml/saml.module';
import { CounterModule } from './counter/counter-module';
import { DatabaseModule } from './database/database-module';
import { LoginModule } from './auth/login/login-module';
import { DriveModule } from './drive/drive-module';
import { GamificationModule } from './gamification/gamification-module';
import { GroupsModule } from './groups/groups-module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SamlModule,
    LoginModule,
    CounterModule,
    GamificationModule,
    GroupsModule,
    DriveModule,
  ],
})
export class AppModule {}
