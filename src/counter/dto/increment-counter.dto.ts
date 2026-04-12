import { IsInt, Min } from 'class-validator';

/** Request body for `POST /api/counter/increment`. */
export class IncrementCounterDto {
  @IsInt()
  @Min(0)
  currentCount!: number;
}
