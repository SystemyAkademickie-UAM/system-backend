import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { USER_NICKNAME_MAX_LENGTH } from '../../constants/user-profile-constants';

/**
 * DTO for patching profile settings of the logged-in user.
 */
export class UpdateProfileSettingsDto {
  /** Optional opaque token parameter. */
  @IsOptional()
  @IsString()
  auth?: string;

  /** New nickname. Must be non-empty and at most 15 characters. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(USER_NICKNAME_MAX_LENGTH)
  nickname?: string;

  /** New avatar ID. Must be a valid integer. */
  @IsOptional()
  @IsInt()
  avatarId?: number;

  /** When false, nickname is hidden from students and other lecturers. */
  @IsOptional()
  @IsBoolean()
  showNickname?: boolean;
}
