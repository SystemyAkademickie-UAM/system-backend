import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateShopItemFromTemplateDto {
  @IsOptional()
  @IsString()
  auth?: string;

  @IsInt()
  templateId: number;

  @IsOptional()
  @IsInt()
  categoryId?: number;

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
}
