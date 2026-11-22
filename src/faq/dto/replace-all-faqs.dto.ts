import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';

import { CreateFaqDto } from './create-faq.dto';

/**
 * Payload submitted when replacing the entire FAQ page content at once (Edit -> Save workflow).
 */
export class ReplaceAllFaqsDto {
  @ApiProperty({ type: [CreateFaqDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateFaqDto)
  items: CreateFaqDto[];
}

