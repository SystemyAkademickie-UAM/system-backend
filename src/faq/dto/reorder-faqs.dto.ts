import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';

import { FaqOrderItemDto } from './faq-order-item.dto';

/**
 * Payload submitted when batch reordering FAQ entries.
 */
export class ReorderFaqsDto {
  @ApiProperty({ type: [FaqOrderItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => FaqOrderItemDto)
  items: FaqOrderItemDto[];
}

