import { ArrayUnique, IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO for bulk set of activity completions for a group activity.
 */
export class SetActivityCompletionsDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  /** Target set of student account IDs with the activity completed. */
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  accountIds: number[];
}
