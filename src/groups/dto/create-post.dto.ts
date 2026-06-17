import { Transform } from 'class-transformer';
import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePostDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  @Transform(({ value }) => (value === undefined || value === null ? '' : String(value).trim()))
  @IsString()
  @IsNotEmpty()
  title: string;

  @Transform(({ value }) => (value === undefined || value === null ? '' : String(value).trim()))
  @IsString()
  @IsNotEmpty()
  content: string;

  /** ISO-8601 creation date sent from the frontend (e.g. `"2026-06-15T20:00:00.000Z"`). */
  @IsOptional()
  @IsISO8601()
  createdAt?: string;
}
