import { IsBoolean, IsDefined, IsOptional, IsString } from 'class-validator';

export class UpdateShopStatusDto {
  /**
   * Shop status (true = open, false = closed).
   */
  @IsDefined()
  @IsBoolean()
  shopOpen: boolean;

  /**
   * Optional API token (e.g. from mobile clients).
   */
  @IsOptional()
  @IsString()
  auth?: string;
}
