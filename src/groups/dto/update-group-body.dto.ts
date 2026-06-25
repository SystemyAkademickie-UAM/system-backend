import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

function transformOptionalString(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return String(value);
}

export class UpdateGroupPayloadDto {
  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  name?: string;

  /** Optional academic subject name (separate from `name`). */
  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  subjectName?: string;

  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  description?: string;

  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  currency?: string;

  /** ASCII emoji for the group currency (e.g. "🥕"). */
  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  currencyEmoji?: string;

  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    if (typeof value === 'string') {
      const n = Number.parseInt(value.trim(), 10);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  lives?: number;

  /** Starting number of lives for new enrollments (must not exceed `lives` cap). */
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    if (typeof value === 'string') {
      const n = Number.parseInt(value.trim(), 10);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  startingLives?: number;

  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  livesIcon?: string;

  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  imageRef?: string;
}

export class UpdateGroupBodyDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  @ValidateNested()
  @Type(() => UpdateGroupPayloadDto)
  group: UpdateGroupPayloadDto;
}
