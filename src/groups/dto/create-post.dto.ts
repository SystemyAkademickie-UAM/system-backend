import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
