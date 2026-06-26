import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { GAMIFICATION_ITEM_CATEGORY_NAME_MAX_LENGTH } from '../../constants/database-entity-constants';

/**
 * DTO for creating a shop item category within a course group.
 */
export class CreateItemCategoryDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(GAMIFICATION_ITEM_CATEGORY_NAME_MAX_LENGTH)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;
}
