import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

/**
 * DTO for creating a rank within a course group.
 * Frontend sends camelCase; service maps to snake_case columns.
 */
export class CreateRankDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

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

  /** Flat currency discount in the store (integer). */
  @IsOptional()
  @IsInt()
  @Min(0)
  storeDiscount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  uniqueStoreItems?: string[];

  /** Percentage discount (decimal %, 0-100) in the store. Differs from flat `storeDiscount`. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;
}
