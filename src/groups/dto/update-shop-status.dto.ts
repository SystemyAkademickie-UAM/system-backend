import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateShopStatusDto {
  /**
   * Status sklepu (true = otwarty, false = zamknięty).
   */
  @IsNotEmpty()
  @IsBoolean()
  shopOpen: boolean;
}
