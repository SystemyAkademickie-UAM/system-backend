import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class SaveGroupTemplateDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  @Transform(({ value }) => (value === undefined || value === null ? '' : String(value).trim()))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  /**
   * Dev-only: assign template ownership to another lecturer in the same organization.
   * Ignored in production.
   */
  @IsOptional()
  @IsEmail()
  devCreatorEmail?: string;
}
