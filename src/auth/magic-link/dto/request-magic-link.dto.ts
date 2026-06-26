import { Type } from 'class-transformer';
import { IsEmail, IsInt, MaxLength, Min } from 'class-validator';

import { AUTH_USER_EMAIL_MAX_LENGTH } from '../../../constants/database-entity-constants';

/** Payload for `POST /login/magic-link/request`. */
export class RequestMagicLinkDto {
  @IsEmail()
  @MaxLength(AUTH_USER_EMAIL_MAX_LENGTH)
  email: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  organizationId: number;
}
