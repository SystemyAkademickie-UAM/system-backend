import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

import { EDUCATION_ENROLLMENT_CODE_MAX_LENGTH } from '../../constants/database-entity-constants';
import { ENROLLMENT_CODE_MIN_MAX_USES } from '../../constants/enrollment-code-constants';

export class CreateEnrollmentCodeDto {
  @IsOptional()
  @IsString()
  auth?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(EDUCATION_ENROLLMENT_CODE_MAX_LENGTH)
  code?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(ENROLLMENT_CODE_MIN_MAX_USES)
  maxUses?: number;
}

export class UpdateEnrollmentCodeDto {
  @IsOptional()
  @IsString()
  auth?: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(ENROLLMENT_CODE_MIN_MAX_USES)
  maxUses?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
