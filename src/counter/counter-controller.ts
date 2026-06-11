import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IncrementCounterDto } from './dto/increment-counter.dto';
import { CounterService } from './counter-service';

/**
 * HTTP surface for the sample counter flow.
 */
@ApiTags('Counter')
@Controller('counter')
export class CounterController {
  constructor(private readonly counterService: CounterService) {}

  /**
   * Smoke check that the counter route group is mounted (no business logic).
   */
  @Get('health')
  @ApiOperation({ summary: 'Smoke health check' })
  @ApiOkResponse({
    description: 'Service is reachable',
    schema: { type: 'object', properties: { ok: { type: 'boolean', example: true } } },
  })
  healthCheck(): { ok: true } {
    return { ok: true };
  }

  /**
   * @param body - Validated request body with `currentCount`
   * @returns JSON body `{ count }` — incremented value
   */
  @Post('increment')
  @ApiOperation({ summary: 'Increment a client-side counter sample' })
  @ApiOkResponse({
    description: 'Incremented count',
    schema: {
      type: 'object',
      properties: { count: { type: 'integer', example: 4 } },
    },
  })
  increment(@Body() body: IncrementCounterDto): { count: number } {
    const count = this.counterService.increment(body.currentCount);
    return { count };
  }
}
