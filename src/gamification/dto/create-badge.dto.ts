import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO for creating a badge within a course group.
 * Frontend sends camelCase; service maps to snake_case columns.
 */
export class CreateBadgeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  icon: string;

  @IsString()
  @IsNotEmpty()
  educationalDescription: string;

  @IsOptional()
  @IsString()
  storyDescription?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rewardAmount?: number;
}
