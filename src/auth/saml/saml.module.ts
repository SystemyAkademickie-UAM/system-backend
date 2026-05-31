import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountEntity } from '../../database/entities/account.entity';
import { IdpCertificateEntity } from '../../database/entities/idp-certificate.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { LoginModule } from '../login/login-module';
import { SamlLinkedUserService } from '../login/saml-linked-user.service';
import { SamlAccountProvisioningService } from './saml-account-provisioning.service';
import { SamlController } from './saml.controller';
import { SamlOrganizationConfigService } from './saml-organization-config.service';
import { SamlOrganizationsService } from './saml-organizations.service';
import { SamlService } from './saml.service';
import { SamlConfigService } from './saml-config.service';

const DEFAULT_JWT_EXPIRES_SECONDS = 8 * 60 * 60;

@Module({
  imports: [
    forwardRef(() => LoginModule),
    TypeOrmModule.forFeature([OrganizationEntity, IdpCertificateEntity, AccountEntity, UserEntity]),
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
  providers: [
    SamlService,
    SamlConfigService,
    SamlOrganizationsService,
    SamlOrganizationConfigService,
    SamlAccountProvisioningService,
    SamlLinkedUserService,
  ],
  exports: [SamlService, SamlConfigService, SamlOrganizationsService, SamlOrganizationConfigService],
})
export class SamlModule {}
