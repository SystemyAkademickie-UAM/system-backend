import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountEntity } from '../../database/entities/account.entity';
import { IdpCertificateEntity } from '../../database/entities/idp-certificate.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { LoginModule } from '../login/login-module';
import { SuperAdminBootstrapModule } from '../../admin/bootstrap/super-admin-bootstrap.module';
import { SamlLinkedUserService } from '../login/saml-linked-user.service';
import { SamlAccountProvisioningService } from './saml-account-provisioning.service';
import { SamlController } from './saml.controller';
import { SamlOrganizationConfigService } from './saml-organization-config.service';
import { SamlOrganizationsService } from './saml-organizations.service';
import { SamlRelayStateTokenService } from './saml-relay-state-token.service';
import { SamlService } from './saml.service';
import { SamlConfigService } from './saml-config.service';

const DEFAULT_JWT_EXPIRES_SECONDS = 8 * 60 * 60;

const LOCAL_DEV_SAML_JWT_SECRET_FALLBACK = 'dev-secret-not-for-production';

/** Returns the configured SAML JWT secret; throws in production rather than using a dev fallback. */
function resolveSamlJwtSecret(config: ConfigService): string {
  const configured = config.get<string>('SAML_JWT_SECRET')?.trim() ?? '';
  if (configured.length > 0) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SAML_JWT_SECRET must be set in production');
  }
  return LOCAL_DEV_SAML_JWT_SECRET_FALLBACK;
}

@Module({
  imports: [
    forwardRef(() => LoginModule),
    SuperAdminBootstrapModule,
    TypeOrmModule.forFeature([OrganizationEntity, IdpCertificateEntity, AccountEntity, UserEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveSamlJwtSecret(config),
        signOptions: { expiresIn: DEFAULT_JWT_EXPIRES_SECONDS },
      }),
    }),
  ],
  controllers: [SamlController],
  providers: [
    SamlService,
    SamlConfigService,
    SamlOrganizationsService,
    SamlOrganizationConfigService,
    SamlAccountProvisioningService,
    SamlLinkedUserService,
    SamlRelayStateTokenService,
  ],
  exports: [SamlService, SamlConfigService, SamlOrganizationsService, SamlOrganizationConfigService],
})
export class SamlModule {}
