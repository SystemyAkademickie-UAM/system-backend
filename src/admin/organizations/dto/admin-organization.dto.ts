import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH,
  AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH,
  AUTH_ORGANIZATION_NAME_MAX_LENGTH,
} from '../../../constants/database-entity-constants';
import {
  ORGANIZATION_LOGIN_METHOD_EMAIL,
  ORGANIZATION_LOGIN_METHOD_SAML,
} from '../../../constants/organization-constants';

export class CreateOrganizationDto {
  @ApiPropertyOptional({ description: 'Opaque token when `maq_auth` cookie is unavailable' })
  @IsOptional()
  @IsString()
  auth?: string;

  @ApiProperty({ example: 'Uniwersytet im. Adama Mickiewicza w Poznaniu' })
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_ORGANIZATION_NAME_MAX_LENGTH)
  name: string;

  @ApiPropertyOptional({ example: 'it-helpdesk@amu.edu.pl' })
  @IsOptional()
  @IsEmail()
  @MaxLength(AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH)
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH)
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'IdP entity ID when metadata URL is not used' })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional({
    example: 'https://sso.amu.edu.pl/simplesaml/saml2/idp/metadata.php',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  metadataUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ssoLoginUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ssoLogoutUrl?: string;

  /** Optional initial IdP signing certificate (PEM). */
  @ApiPropertyOptional({ description: 'Initial IdP signing certificate (PEM)' })
  @IsOptional()
  @IsString()
  certificatePem?: string;

  @ApiPropertyOptional({
    description: 'Tenant login method',
    enum: [ORGANIZATION_LOGIN_METHOD_SAML, ORGANIZATION_LOGIN_METHOD_EMAIL],
  })
  @IsOptional()
  @IsIn([ORGANIZATION_LOGIN_METHOD_SAML, ORGANIZATION_LOGIN_METHOD_EMAIL])
  loginMethod?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  auth?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_ORGANIZATION_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH)
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH)
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  entityId?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  metadataUrl?: string | null;

  @IsOptional()
  @IsString()
  ssoLoginUrl?: string | null;

  @IsOptional()
  @IsString()
  ssoLogoutUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UploadOrganizationCertificateDto {
  @IsOptional()
  @IsString()
  auth?: string;

  @IsString()
  @MinLength(1)
  certificatePem: string;
}
