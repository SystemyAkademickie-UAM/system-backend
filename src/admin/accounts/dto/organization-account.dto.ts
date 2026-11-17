import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  AUTH_USER_EMAIL_MAX_LENGTH,
  AUTH_USER_NAME_FIELD_MAX_LENGTH,
} from '../../../constants/database-entity-constants';
import {
  ORGANIZATION_ACCOUNT_IMPORT_MAX_ROWS,
  ORGANIZATION_ACCOUNT_PAGE_SIZE_MAX,
  ORGANIZATION_ACCOUNT_SUPER_ASSIGNABLE_ROLES,
} from '../../../constants/organization-account-management-constants';

export class CreateOrganizationAccountDto {
  @ApiProperty({ example: 'student@university.example' })
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

  @ApiPropertyOptional({ example: 'ada' })
  @IsOptional()
  @IsString()
  @MaxLength(AUTH_USER_NAME_FIELD_MAX_LENGTH)
  nickname?: string;

  @ApiProperty({ enum: ORGANIZATION_ACCOUNT_SUPER_ASSIGNABLE_ROLES })
  @IsIn(ORGANIZATION_ACCOUNT_SUPER_ASSIGNABLE_ROLES)
  role: string;
}

export class UpdateOrganizationAccountDto {
  @ApiPropertyOptional({ example: 'student@university.example' })
  @IsOptional()
  @IsEmail()
  @MaxLength(AUTH_USER_EMAIL_MAX_LENGTH)
  email?: string;

  @ApiPropertyOptional({ example: 'Ada' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_USER_NAME_FIELD_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ example: 'Lovelace' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_USER_NAME_FIELD_MAX_LENGTH)
  surname?: string;

  @ApiPropertyOptional({ example: 'ada' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_USER_NAME_FIELD_MAX_LENGTH)
  nickname?: string;

  @ApiPropertyOptional({ enum: ORGANIZATION_ACCOUNT_SUPER_ASSIGNABLE_ROLES })
  @IsOptional()
  @IsIn(ORGANIZATION_ACCOUNT_SUPER_ASSIGNABLE_ROLES)
  role?: string;
}

export class ImportOrganizationAccountsDto {
  @ApiProperty({ type: [CreateOrganizationAccountDto] })
  @IsArray()
  @ArrayMaxSize(ORGANIZATION_ACCOUNT_IMPORT_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => CreateOrganizationAccountDto)
  users: CreateOrganizationAccountDto[];
}

export class ListOrganizationAccountsPageQueryDto {
  @ApiPropertyOptional({
    description: 'Return accounts whose id is greater than this value. Use the previous page nextAfterAccountId.',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  afterAccountId?: number;

  @ApiPropertyOptional({
    default: 100,
    maximum: ORGANIZATION_ACCOUNT_PAGE_SIZE_MAX,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ORGANIZATION_ACCOUNT_PAGE_SIZE_MAX)
  limit?: number;
}
