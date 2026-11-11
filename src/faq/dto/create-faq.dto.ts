import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import {
  DEFAULT_FAQ_CATEGORY,
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_CATEGORY_MAX_LENGTH,
  FAQ_QUESTION_MAX_LENGTH,
} from '../../constants/faq-constants';

function normalizeText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeOptionalText({ value }: { value: unknown }): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }
  return value;
}

/**
 * Payload submitted when creating a new FAQ knowledge base entry.
 */
export class CreateFaqDto {
  @ApiProperty({
    example: 'Jak zmienić hasło?',
    maxLength: FAQ_QUESTION_MAX_LENGTH,
  })
  @Transform(normalizeText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(FAQ_QUESTION_MAX_LENGTH)
  question: string;

  @ApiProperty({
    example: 'Aby zmienić hasło, przejdź do ustawień profilu...',
    maxLength: FAQ_ANSWER_MAX_LENGTH,
  })
  @Transform(normalizeText)
  @IsString()
  @IsNotEmpty()
  @MaxLength(FAQ_ANSWER_MAX_LENGTH)
  answer: string;

  @ApiPropertyOptional({
    example: 'Konto',
    maxLength: FAQ_CATEGORY_MAX_LENGTH,
    default: DEFAULT_FAQ_CATEGORY,
  })
  @Transform(normalizeOptionalText)
  @IsOptional()
  @IsString()
  @MaxLength(FAQ_CATEGORY_MAX_LENGTH)
  category?: string;

  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
    default: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

