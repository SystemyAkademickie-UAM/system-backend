import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export enum GroupTemplateScope {
  MY = 'my',
  PUBLIC = 'public',
}

export class GetGroupTemplatesQueryDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  @IsOptional()
  @IsEnum(GroupTemplateScope)
  scope?: GroupTemplateScope = GroupTemplateScope.PUBLIC;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

export class UpdateGroupTemplateDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value).trim()))
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
