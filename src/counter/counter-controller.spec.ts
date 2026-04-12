import { Test, TestingModule } from '@nestjs/testing';
import { CounterController } from './counter-controller';
import { CounterService } from './counter-service';

describe('CounterController', () => {
  let controller: CounterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CounterController],
      providers: [CounterService],
    }).compile();
    controller = module.get<CounterController>(CounterController);
  });

  describe('healthCheck', () => {
    it('returns ok true', () => {
      const actual = controller.healthCheck();
      const expected = { ok: true as const };
      expect(actual).toEqual(expected);
    });
  });

  describe('increment', () => {
    it('returns incremented count from service', () => {
      const inputBody = { currentCount: 3 };
      const actual = controller.increment(inputBody);
      const expected = { count: 4 };
      expect(actual).toEqual(expected);
    });
  });
});
