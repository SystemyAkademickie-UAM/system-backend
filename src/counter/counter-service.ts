import { Injectable } from '@nestjs/common';
import { INCREMENT_STEP } from '../constants/counter-constants';

/**
 * Applies the counter increment rule for API requests.
 */
@Injectable()
export class CounterService {
  /**
   * @param currentCount - Last value from the client
   * @returns Next count after applying `INCREMENT_STEP`
   */
  increment(currentCount: number): number {
    return currentCount + INCREMENT_STEP;
  }
}
