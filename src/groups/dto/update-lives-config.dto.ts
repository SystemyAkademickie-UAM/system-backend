import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Payload for `PATCH /groups/:groupId/lives-config`.
 * Only provided fields are updated; omitted fields are left untouched.
 */
export class UpdateLivesConfigDto {
  /** Master toggle — enables or disables the lives system for the group. */
  @IsOptional()
  @IsBoolean()
  livesEnabled?: boolean;

  /** Maximum number of lives a student can have. */
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
  @Min(1)
  lives?: number;

  /** Custom display name for lives (e.g. "Tarcze", "Serca"). */
  @IsOptional()
  @IsString()
  livesLabel?: string;

  /** Icon reference for lives. */
  @IsOptional()
  @IsString()
  livesIcon?: string;

  /** Whether "extra life" appears as a purchasable shop product. */
  @IsOptional()
  @IsBoolean()
  livesShopEnabled?: boolean;

  /** Optional API token (e.g. from mobile clients). */
  @IsOptional()
  @IsString()
  auth?: string;
}
