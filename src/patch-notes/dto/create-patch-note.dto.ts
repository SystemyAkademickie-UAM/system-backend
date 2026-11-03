import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import {
  PATCH_NOTES_TITLE_MAX_LENGTH,
  PATCH_NOTES_VERSION_MAX_LENGTH,
} from '../../constants/patch-notes-constants';

function normalizeOptionalText({ value }: { value: unknown }): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }
  return value;
}

/**
 * Optional metadata fields submitted alongside a patch note PDF upload.
 */
export class CreatePatchNoteDto {
  @ApiPropertyOptional({
    example: 'Patch Notes 1.2.0',
    maxLength: PATCH_NOTES_TITLE_MAX_LENGTH,
  })
  @Transform(normalizeOptionalText)
  @IsOptional()
  @IsString()
  @MaxLength(PATCH_NOTES_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({
    example: 'v1.2.0',
    maxLength: PATCH_NOTES_VERSION_MAX_LENGTH,
  })
  @Transform(normalizeOptionalText)
  @IsOptional()
  @IsString()
  @MaxLength(PATCH_NOTES_VERSION_MAX_LENGTH)
  version?: string;
}
