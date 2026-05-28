import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BadgeRarity } from '../../database/entities/badge.entity';

/**
 * DTO for updating a badge within a course group.
 * All fields are optional - only provided fields will be updated.
 */
export class UpdateBadgeDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  educationalDescription?: string;

  @IsOptional()
  @IsString()
  storyDescription?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rewardAmount?: number;

  @IsOptional()
  @IsEnum(BadgeRarity)
  rarity?: BadgeRarity;
}
