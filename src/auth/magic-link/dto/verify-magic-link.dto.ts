import { IsString, MinLength } from 'class-validator';

/** Payload for `POST /login/magic-link/verify`. */
export class VerifyMagicLinkDto {
  @IsString()
  @MinLength(16)
  token: string;
}
