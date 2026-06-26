import { IsInt, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

import { USER_NICKNAME_MAX_LENGTH } from '../../../constants/user-profile-constants';

/**
 * DTO for the registration wizard profile step (`POST /login/profile`).
 */
export class UpdateLoginProfileDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(USER_NICKNAME_MAX_LENGTH)
  nickname!: string;

  @IsInt()
  avatarId!: number;
}
