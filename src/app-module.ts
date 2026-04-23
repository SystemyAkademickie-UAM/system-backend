import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SamlAuthModule } from './auth/saml/saml-auth.module';
import { CounterModule } from './counter/counter-module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SamlAuthModule, CounterModule],
})
export class AppModule {}
