import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SamlAuthModule } from './auth/saml/saml-auth.module';
import { CounterModule } from './counter/counter-module';
import { DatabaseModule } from './database/database-module';
import { LoginModule } from './auth/login/login-module';
import { DriveModule } from './drive/drive-module';
import { GroupsModule } from './groups/groups-module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SamlAuthModule,
    LoginModule,
    CounterModule,
    GroupsModule,
    DriveModule,
  ],
})
export class AppModule {}
