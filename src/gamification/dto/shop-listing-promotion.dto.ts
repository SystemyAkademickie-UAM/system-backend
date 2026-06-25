import { IsIn, IsInt, Max, Min, ValidateIf } from 'class-validator';

import { SHOP_PROMOTION_PERCENT_MAX } from '../../constants/shop-promotion-constants';
import { PromotionType } from '../../database/entities/badge.entity';

export class ShopListingPromotionDto {
  @IsInt()
  id: number;

  @IsIn([PromotionType.PERCENT, PromotionType.FIXED])
  promotionType: string;

  @IsInt()
  @Min(0)
  @ValidateIf((dto: ShopListingPromotionDto) => dto.promotionType === PromotionType.PERCENT)
  @Max(SHOP_PROMOTION_PERCENT_MAX)
  value: number;
}
