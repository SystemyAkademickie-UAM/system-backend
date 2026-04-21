import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';

import { SAML_SESSION_JWT_EXPIRES_IN } from '../../constants/saml-constants';
import { SamlAuthController } from './saml-auth.controller';
import { SamlAuthService } from './saml-auth.service';
import { SamlConfigService } from './saml-config.service';
import { SamlPassportBootstrapService } from './saml-passport-bootstrap.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresInRaw =
          config.get<string>('SAML_SESSION_JWT_EXPIRES_IN')?.trim() || SAML_SESSION_JWT_EXPIRES_IN;
        const expiresIn = expiresInRaw as SignOptions['expiresIn'];
        const secret = config.get<string>('SAML_SESSION_JWT_SECRET')?.trim();
        if (secret !== undefined && secret.length > 0) {
          return {
            secret,
            signOptions: { expiresIn },
          };
        }
        if (process.env.NODE_ENV === 'production') {
          throw new Error('SAML_SESSION_JWT_SECRET is required when NODE_ENV=production');
        }
        return {
          secret: 'local-dev-only-saml-jwt-secret-not-for-production',
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  controllers: [SamlAuthController],
  providers: [SamlConfigService, SamlPassportBootstrapService, SamlAuthService],
  exports: [SamlConfigService, SamlAuthService],
})
export class SamlAuthModule {}
