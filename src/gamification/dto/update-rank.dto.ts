import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

/**
 * DTO for updating a rank within a course group.
 * All fields are optional - only provided fields will be updated.
 */
export class UpdateRankDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  requiredPoints?: number;

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
