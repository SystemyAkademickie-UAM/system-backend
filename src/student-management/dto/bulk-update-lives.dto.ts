import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

import { BULK_UPDATE_LIVES_MAX_STUDENTS } from '../../constants/lives-constants';

/**
 * Single item in the bulk-lives-update payload.
 */
export class BulkUpdateLivesItemDto {
  /** The student's account ID. */
  @IsInt()
  accountId: number;

  /**
   * Delta to apply to the student's lives.
   * Positive value adds lives; negative value removes lives (clamped to 0 at the bottom
   * and to the group's `lives` cap at the top).
   */
  @IsInt()
  delta: number;
}

/**
 * DTO for `PATCH /groups/:groupId/students/lives/bulk-update`.
 * Frontend sends `{ students: [{accountId, delta},...], auth?: string }`.
 */
export class BulkUpdateLivesDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(BULK_UPDATE_LIVES_MAX_STUDENTS)
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateLivesItemDto)
  students: BulkUpdateLivesItemDto[];
}
