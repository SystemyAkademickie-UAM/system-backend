import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateLogRetentionDto {
  @ApiProperty({
    description: 'Liczba dni retencji logów systemowych (od 1 do 3650, domyślnie 90)',
    example: 90,
    minimum: 1,
    maximum: 3650,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  ttlDays: number;
}
