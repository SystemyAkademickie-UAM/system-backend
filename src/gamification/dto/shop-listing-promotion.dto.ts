import { IsInt, IsString } from 'class-validator';

export class ShopListingPromotionDto {
  @IsInt()
  id: number;

  @IsString()
  promotionType: string;

  @IsInt()
  value: number;
}
