import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH,
  AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH,
  AUTH_ORGANIZATION_NAME_MAX_LENGTH,
} from '../../../constants/database-entity-constants';

export class CreateOrganizationDto {
  @IsOptional()
  @IsString()
  auth?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_ORGANIZATION_NAME_MAX_LENGTH)
  name: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  metadataUrl?: string;

  @IsOptional()
  @IsString()
  ssoLoginUrl?: string;

  @IsOptional()
  @IsString()
  ssoLogoutUrl?: string;

  /** Optional initial IdP signing certificate (PEM). */
  @IsOptional()
  @IsString()
  certificatePem?: string;
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
