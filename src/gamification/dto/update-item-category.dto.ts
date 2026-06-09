import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { GAMIFICATION_ITEM_CATEGORY_NAME_MAX_LENGTH } from '../../constants/database-entity-constants';

/**
 * DTO for updating a shop item category within a course group.
 */
export class UpdateItemCategoryDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(GAMIFICATION_ITEM_CATEGORY_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
