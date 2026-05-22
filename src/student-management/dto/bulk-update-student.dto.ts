import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

/**
 * Single item in the bulk-update payload for student stats.
 */
export class BulkUpdateStudentItemDto {
  @IsInt()
  enrollmentId: number;

  @IsOptional()
  @IsInt()
  rankId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  currency?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalEarned?: number;
}

/**
 * DTO wrapping the bulk-update request body.
 * Frontend sends `{ students: [...], auth?: string }`.
 */
export class BulkUpdateStudentsDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateStudentItemDto)
  students: BulkUpdateStudentItemDto[];
}
