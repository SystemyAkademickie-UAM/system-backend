import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SamlAuthModule } from './auth/saml/saml-auth.module';
import { CounterModule } from './counter/counter-module';
import { GroupsModule } from './groups/groups.module';
import { StudentModule } from './student/student.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SamlAuthModule,
    CounterModule,
    GroupsModule,
    StudentModule,
  ],
})
export class AppModule { }
