import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { GAMIFICATION_BADGE_NAME_MAX_LENGTH, EDUCATION_GROUP_VARCHAR_MAX_LENGTH } from '../../constants/database-entity-constants';
import { ShopListingPromotionDto } from './shop-listing-promotion.dto';

export class CreateShopItemDto {
  @IsOptional()
  @IsString()
  auth?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(GAMIFICATION_BADGE_NAME_MAX_LENGTH)
  name: string;

  @IsString()
  @IsOptional()
  storyDescription?: string;

  @IsString()
  @IsOptional()
  educationalDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(EDUCATION_GROUP_VARCHAR_MAX_LENGTH)
  imageRef?: string;

  @IsInt()
  @IsOptional()
  categoryId?: number;

  @IsInt()
  @Min(0)
  basePrice: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  stockQuantity?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  perStudentLimit?: number;

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
