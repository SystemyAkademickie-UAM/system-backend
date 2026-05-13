import { IsOptional, IsString } from 'class-validator';

export class EnrollGroupBodyDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;
}
