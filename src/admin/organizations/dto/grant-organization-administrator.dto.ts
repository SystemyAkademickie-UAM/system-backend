import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AUTH_USER_EMAIL_MAX_LENGTH } from '../../../constants/database-entity-constants';

export class GrantOrganizationAdministratorDto {
  @ApiPropertyOptional({ description: 'Opaque token when `maq_auth` cookie is unavailable' })
  @IsOptional()
  @IsString()
  auth?: string;

  @ApiProperty({ example: 'administrator@localhost.invalid' })
  @IsEmail()
  @MaxLength(AUTH_USER_EMAIL_MAX_LENGTH)
  email: string;
}
