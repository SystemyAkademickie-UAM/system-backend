import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  AUTH_ORGANIZATION_ADDRESS_BUILDING_MAX_LENGTH,
  AUTH_ORGANIZATION_ADDRESS_COUNTRY_MAX_LENGTH,
  AUTH_ORGANIZATION_ADDRESS_POSTAL_CODE_MAX_LENGTH,
  AUTH_ORGANIZATION_ADDRESS_STREET_MAX_LENGTH,
  AUTH_ORGANIZATION_ADDRESS_TOWN_MAX_LENGTH,
  AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH,
  AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH,
  AUTH_ORGANIZATION_DOMAIN_MAX_LENGTH,
  AUTH_ORGANIZATION_NAME_MAX_LENGTH,
  AUTH_ORGANIZATION_REPRESENTATIVE_NAME_MAX_LENGTH,
} from '../../../constants/database-entity-constants';
import {
  ORGANIZATION_BULK_MAX_IDS,
  ORGANIZATION_COUNTRY_CODE_PATTERN,
  ORGANIZATION_DOMAIN_INVALID_MESSAGE,
  ORGANIZATION_DOMAIN_PATTERN,
  ORGANIZATION_LOGIN_METHOD_EMAIL,
  ORGANIZATION_LOGIN_METHOD_SAML,
} from '../../../constants/organization-constants';

export class OrganizationRepresentativeDto {
  @ApiProperty({ example: 'Anna Nowak' })
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_ORGANIZATION_REPRESENTATIVE_NAME_MAX_LENGTH)
  fullName: string;

  @ApiProperty({ example: 'it-helpdesk@amu.edu.pl' })
  @IsEmail()
  @MaxLength(AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH)
  email: string;

  @ApiPropertyOptional({ example: '+48 61 829 4000' })
  @IsOptional()
  @IsString()
  @MaxLength(AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH)
  phone?: string;
}

export class OrganizationAddressDto {
  @ApiProperty({ example: 'Poznań' })
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_ORGANIZATION_ADDRESS_TOWN_MAX_LENGTH)
  town: string;

  @ApiProperty({ example: 'ul. Wieniawskiego' })
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_ORGANIZATION_ADDRESS_STREET_MAX_LENGTH)
  street: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  @MaxLength(AUTH_ORGANIZATION_ADDRESS_BUILDING_MAX_LENGTH)
  building?: string;

  @ApiPropertyOptional({ example: '61-712' })
  @IsOptional()
  @IsString()
  @MaxLength(AUTH_ORGANIZATION_ADDRESS_POSTAL_CODE_MAX_LENGTH)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'PL', description: 'ISO 3166-1 alpha-2' })
  @IsOptional()
  @IsString()
  @MaxLength(AUTH_ORGANIZATION_ADDRESS_COUNTRY_MAX_LENGTH)
  @Matches(ORGANIZATION_COUNTRY_CODE_PATTERN)
  country?: string;
}

export class UpdateOrganizationRepresentativeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_ORGANIZATION_REPRESENTATIVE_NAME_MAX_LENGTH)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH)
  email?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH)
  phone?: string | null;
}

export class UpdateOrganizationAddressDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_ORGANIZATION_ADDRESS_TOWN_MAX_LENGTH)
  town?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_ORGANIZATION_ADDRESS_STREET_MAX_LENGTH)
  street?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(AUTH_ORGANIZATION_ADDRESS_BUILDING_MAX_LENGTH)
  building?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(AUTH_ORGANIZATION_ADDRESS_POSTAL_CODE_MAX_LENGTH)
  postalCode?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(AUTH_ORGANIZATION_ADDRESS_COUNTRY_MAX_LENGTH)
  @Matches(ORGANIZATION_COUNTRY_CODE_PATTERN)
  country?: string | null;
}

export class BulkOrganizationsDto {
  @ApiPropertyOptional({ description: 'Opaque token when `maq_auth` cookie is unavailable' })
  @IsOptional()
  @IsString()
  auth?: string;

  @ApiProperty({ type: [Number], example: [11, 12] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ORGANIZATION_BULK_MAX_IDS)
  @IsInt({ each: true })
  ids: number[];
}

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

  @ApiProperty({
    example: 'amu.edu.pl',
    description: 'Hostname, localhost, 127.0.0.1, or 192.168.0.x. Stored lower-case.',
  })
  @IsString()
  @MaxLength(AUTH_ORGANIZATION_DOMAIN_MAX_LENGTH)
  @Matches(ORGANIZATION_DOMAIN_PATTERN, { message: ORGANIZATION_DOMAIN_INVALID_MESSAGE })
  domain: string;

  @ApiProperty({ type: OrganizationRepresentativeDto })
  @ValidateNested()
  @Type(() => OrganizationRepresentativeDto)
  representative: OrganizationRepresentativeDto;

  @ApiProperty({ type: OrganizationAddressDto })
  @ValidateNested()
  @Type(() => OrganizationAddressDto)
  address: OrganizationAddressDto;

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

  @ApiProperty({
    description: 'saml is PIONIER. email is magic-link login.',
    enum: [ORGANIZATION_LOGIN_METHOD_SAML, ORGANIZATION_LOGIN_METHOD_EMAIL],
  })
  @IsIn([ORGANIZATION_LOGIN_METHOD_SAML, ORGANIZATION_LOGIN_METHOD_EMAIL])
  loginMethod: string;
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
  @IsString()
  @MaxLength(AUTH_ORGANIZATION_DOMAIN_MAX_LENGTH)
  @Matches(ORGANIZATION_DOMAIN_PATTERN, { message: ORGANIZATION_DOMAIN_INVALID_MESSAGE })
  domain?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateOrganizationRepresentativeDto)
  representative?: UpdateOrganizationRepresentativeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateOrganizationAddressDto)
  address?: UpdateOrganizationAddressDto;

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
