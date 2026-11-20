import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  AUTH_USER_EMAIL_MAX_LENGTH,
  AUTH_USER_NAME_FIELD_MAX_LENGTH,
} from '../../../constants/database-entity-constants';

export class GrantOrganizationAdministratorDto {
  @ApiPropertyOptional({ description: 'Opaque token when `maq_auth` cookie is unavailable' })
  @IsOptional()
  @IsString()
  auth?: string;

  @ApiProperty({ description: 'Person who already belongs to this organization' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId: number;
}

export class GrantOrganizationAdministratorByEmailDto {
  @ApiPropertyOptional({ description: 'Opaque token when `maq_auth` cookie is unavailable' })
  @IsOptional()
  @IsString()
  auth?: string;

  @ApiProperty({ example: 'ada@university.example' })
  @IsEmail()
  @MaxLength(AUTH_USER_EMAIL_MAX_LENGTH)
  email: string;

  @ApiProperty({ example: 'Ada' })
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_USER_NAME_FIELD_MAX_LENGTH)
  name: string;

  @ApiProperty({ example: 'Lovelace' })
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_USER_NAME_FIELD_MAX_LENGTH)
  surname: string;
}
