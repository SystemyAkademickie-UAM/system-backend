import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { GAMIFICATION_BADGE_NAME_MAX_LENGTH, EDUCATION_GROUP_VARCHAR_MAX_LENGTH } from '../../constants/database-entity-constants';
import { ShopListingPromotionDto } from './shop-listing-promotion.dto';

export class UpdateShopItemDto {
  @IsOptional()
  @IsString()
  auth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(GAMIFICATION_BADGE_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsString()
  storyDescription?: string;

  @IsOptional()
  @IsString()
  educationalDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(EDUCATION_GROUP_VARCHAR_MAX_LENGTH)
  imageRef?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  categoryIds?: number[];

  @IsOptional()
  @IsInt()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  perStudentLimit?: number;

  /** Toggle shop item visibility. When set to `true`, `publishedAt` is auto-set. */
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShopListingPromotionDto)
  badgePromotions?: ShopListingPromotionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShopListingPromotionDto)
  rankPromotions?: ShopListingPromotionDto[];
}
