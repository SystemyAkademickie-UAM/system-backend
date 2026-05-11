import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SamlModule } from './auth/saml/saml.module';
import { CounterModule } from './counter/counter-module';
import { GroupsModule } from './groups/groups.module';
import { StudentModule } from './student/student.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SamlModule,
    CounterModule,
    GroupsModule,
    StudentModule,
  ],
})
export class AppModule { }
