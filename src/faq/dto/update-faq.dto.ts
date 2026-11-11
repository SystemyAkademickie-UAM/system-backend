import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import {
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_CATEGORY_MAX_LENGTH,
  FAQ_QUESTION_MAX_LENGTH,
} from '../../constants/faq-constants';

function normalizeOptionalText({ value }: { value: unknown }): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }
  return value;
}

/**
 * Payload submitted when updating an existing FAQ entry.
 */
export class UpdateFaqDto {
  @ApiPropertyOptional({
    example: 'Jak zresetować hasło?',
    maxLength: FAQ_QUESTION_MAX_LENGTH,
  })
  @Transform(normalizeOptionalText)
  @IsOptional()
  @IsString()
  @MaxLength(FAQ_QUESTION_MAX_LENGTH)
  question?: string;

  @ApiPropertyOptional({
    example: 'Nowa treść odpowiedzi...',
    maxLength: FAQ_ANSWER_MAX_LENGTH,
  })
  @Transform(normalizeOptionalText)
  @IsOptional()
  @IsString()
  @MaxLength(FAQ_ANSWER_MAX_LENGTH)
  answer?: string;

  @ApiPropertyOptional({
    example: 'Bezpieczeństwo',
    maxLength: FAQ_CATEGORY_MAX_LENGTH,
  })
  @Transform(normalizeOptionalText)
  @IsOptional()
  @IsString()
  @MaxLength(FAQ_CATEGORY_MAX_LENGTH)
  category?: string;

  @ApiPropertyOptional({
    example: 1,
    minimum: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

