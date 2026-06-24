import { IsIn, IsInt, Max, Min } from 'class-validator';
import { PromotionType } from '../../database/entities/badge.entity';

export class ShopListingPromotionDto {
  @IsInt()
  id: number;

  @IsIn([PromotionType.PERCENT, PromotionType.FIXED])
  promotionType: string;

  @IsInt()
  @Min(0)
  value: number;
}
