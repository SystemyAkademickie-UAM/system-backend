import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

function transformOptionalString(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return String(value);
}

/**
 * DTO for updating currency settings of a course group.
 */
export class UpdateCurrencyDto {
  /** New display name for the group currency (e.g. "carrots"). */
  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  currency?: string;

  /** New icon/emoji for the group currency (e.g. "🥕"). */
  @Transform(({ value }) => transformOptionalString(value))
  @IsOptional()
  @IsString()
  currencyIcon?: string;

  /** Optional auth token when not using `maq_auth` cookie. */
  @IsOptional()
  @IsString()
  auth?: string;
}
