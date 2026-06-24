import { IsArray, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { PromotionType } from '../../database/entities/badge.entity';

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  uniqueStoreItems?: string[];

  @IsOptional()
  @IsIn([PromotionType.PERCENT, PromotionType.FIXED])
  globalDiscountType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  globalDiscountValue?: number;
}
