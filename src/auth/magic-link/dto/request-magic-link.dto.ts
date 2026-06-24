import { IsEmail, MaxLength } from 'class-validator';

import { AUTH_USER_EMAIL_MAX_LENGTH } from '../../../constants/database-entity-constants';

/** Payload for `POST /login/magic-link/request`. Organization is resolved server-side from the email. */
export class RequestMagicLinkDto {
  @IsEmail()
  @MaxLength(AUTH_USER_EMAIL_MAX_LENGTH)
  email: string;
}
