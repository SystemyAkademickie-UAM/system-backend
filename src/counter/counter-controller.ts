import { Body, Controller, Get, Post } from '@nestjs/common';
import { IncrementCounterDto } from './dto/increment-counter.dto';
import { CounterService } from './counter-service';

/**
 * HTTP surface for the sample counter flow.
 */
@Controller('counter')
export class CounterController {
  constructor(private readonly counterService: CounterService) {}

  /**
   * Smoke check that the counter route group is mounted (no business logic).
   */
  @Get('health')
  healthCheck(): { ok: true } {
    return { ok: true };
  }

  /**
   * @param body - Validated request body with `currentCount`
   * @returns JSON body `{ count }` — incremented value
   */
  @Post('increment')
  increment(@Body() body: IncrementCounterDto): { count: number } {
    const count = this.counterService.increment(body.currentCount);
    return { count };
  }
}
