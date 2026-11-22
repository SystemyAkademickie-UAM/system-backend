import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

import { DOCUMENTS_TITLE_MAX_LENGTH } from '../../constants/system-documents-constants';

function normalizeOptionalTitle({ value }: { value: unknown }): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }
  return value;
}

/**
 * Optional metadata fields submitted when uploading or replacing a system document PDF.
 */
export class UpsertSystemDocumentDto {
  @ApiPropertyOptional({
    example: 'Terms of Use',
    maxLength: DOCUMENTS_TITLE_MAX_LENGTH,
  })
  @Transform(normalizeOptionalTitle)
  @IsOptional()
  @IsString()
  @MaxLength(DOCUMENTS_TITLE_MAX_LENGTH)
  title?: string;
}

