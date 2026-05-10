import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SamlModule } from './auth/saml/saml.module';
import { CounterModule } from './counter/counter-module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SamlModule, CounterModule],
})
export class AppModule {}
