import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';
import { SHOP_PROMOTION_PERCENT_MAX } from '../../constants/shop-promotion-constants';
import { BadgeRarity, PromotionType } from '../../database/entities/badge.entity';

/**
 * DTO for updating a badge within a course group.
 * All fields are optional - only provided fields will be updated.
 */
export class UpdateBadgeDto {
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

  /** Toggle badge visibility. When set to `true`, `publishedAt` is auto-set. */
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsIn([PromotionType.PERCENT, PromotionType.FIXED])
  globalDiscountType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ValidateIf((dto: UpdateBadgeDto) => dto.globalDiscountType === PromotionType.PERCENT)
  @Max(SHOP_PROMOTION_PERCENT_MAX)
  globalDiscountValue?: number;
}
