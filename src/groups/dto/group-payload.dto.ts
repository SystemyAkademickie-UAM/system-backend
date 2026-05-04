import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GroupPayloadDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  currency: string;

  @IsInt()
  @Min(0)
  currencyIcon: number;

  @IsString()
  life: string;

  @IsInt()
  @Min(0)
  lifeIcon: number;

  @IsOptional()
  @IsString()
  bannerRef?: string;
}
