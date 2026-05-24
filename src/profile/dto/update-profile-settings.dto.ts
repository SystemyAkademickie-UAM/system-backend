import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for patching profile settings of the logged-in user.
 */
export class UpdateProfileSettingsDto {
  /** Optional opaque token parameter. */
  @IsOptional()
  @IsString()
  auth?: string;

  /** New nickname. Must be non-empty and at most 100 characters. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  nickname?: string;

  /** New avatar ID. Must be a valid integer. */
  @IsOptional()
  @IsInt()
  avatarId?: number;
}
