import { Module } from '@nestjs/common';
import { CounterModule } from './counter/counter-module';

@Module({
  imports: [CounterModule],
})
export class AppModule {}
