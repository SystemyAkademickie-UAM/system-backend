import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

function transformOptionalString(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value);
}

export class GroupPayloadDto {
  @Transform(({ value }) => (value === undefined || value === null ? '' : String(value)))
  @IsString()
  @MinLength(1)
  name: string;

  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  description?: string;

  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  currency?: string;

  /** Stored as `currency_icon` (varchar ref); numeric JSON values from legacy clients are coerced to strings. */
  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  currencyIcon?: string;

  /** Stored as `lives` (integer). */
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
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

  /** Stored as `lives_icon` (varchar ref). */
  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  livesIcon?: string;

  /** Image reference (banner). */
  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  imageRef?: string;

  /** Maps to `education.groups.entry_code`. */
  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  entryCode?: string;
}
