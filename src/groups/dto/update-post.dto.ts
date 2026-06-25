import { IsBoolean, IsISO8601, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  /** Toggle post visibility. When set to `true`, `publishedAt` is auto-set by backend. */
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  auth?: string;

  /** Optional ISO-8601 scheduled publication timestamp or null to unschedule. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  publishAt?: string | null;
}
