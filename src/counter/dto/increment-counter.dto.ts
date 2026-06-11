import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Request body for `POST /api/counter/increment`. */
export class IncrementCounterDto {
  @ApiProperty({ type: 'integer', minimum: 0, example: 3 })
  @IsInt()
  @Min(0)
  currentCount!: number;
}
