import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { BadgeRarity, PromotionType } from '../../database/entities/badge.entity';

/**
 * DTO for creating a badge within a course group.
 * Frontend sends camelCase; service maps to snake_case columns.
 */
export class CreateBadgeDto {
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

  @IsOptional()
  @IsString()
  educationalDescription?: string;

  @IsOptional()
  @IsString()
  storyDescription?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rewardAmount?: number;

  @IsOptional()
  @IsEnum(BadgeRarity)
  rarity?: BadgeRarity;

  @IsOptional()
  @IsIn([PromotionType.PERCENT, PromotionType.FIXED])
  globalDiscountType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  globalDiscountValue?: number;
}
