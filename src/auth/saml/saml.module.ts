import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { SamlController } from './saml.controller';
import { SamlService } from './saml.service';
import { SamlConfigService } from './saml-config.service';

const DEFAULT_JWT_EXPIRES_SECONDS = 8 * 60 * 60; // 8 hours

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('SAML_JWT_SECRET') || 'dev-secret-not-for-production',
        signOptions: { expiresIn: DEFAULT_JWT_EXPIRES_SECONDS },
      }),
    }),
  ],
  controllers: [SamlController],
  providers: [SamlService, SamlConfigService],
  exports: [SamlService, SamlConfigService],
})
export class SamlModule {}
