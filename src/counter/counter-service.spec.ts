import { Test, TestingModule } from '@nestjs/testing';
import { CounterService } from './counter-service';

describe('CounterService', () => {
  let service: CounterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CounterService],
    }).compile();
    service = module.get<CounterService>(CounterService);
  });

  describe('increment', () => {
    it('returns one more than the input count', () => {
      const inputCount = 0;
      const actualCount = service.increment(inputCount);
      const expectedCount = 1;
      expect(actualCount).toBe(expectedCount);
    });

    it('handles non-zero input', () => {
      const inputCount = 41;
      const actualCount = service.increment(inputCount);
      const expectedCount = 42;
      expect(actualCount).toBe(expectedCount);
    });
  });
});
