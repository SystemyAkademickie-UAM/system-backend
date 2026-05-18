import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO for creating a rank within a course group.
 * Frontend sends camelCase; service maps to snake_case columns.
 */
export class CreateRankDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  icon: string;

  @IsInt()
  @Min(0)
  requiredPoints: number;

  @IsOptional()
  @IsString()
  storyDescription?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  storeDiscount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  uniqueStoreItems?: string[];
}
