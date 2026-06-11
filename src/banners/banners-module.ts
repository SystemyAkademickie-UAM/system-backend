import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BannerEntity } from '../database/entities/banner.entity';
import { BannersController } from './banners-controller';
import { BannersService } from './banners-service';

@Module({
  imports: [TypeOrmModule.forFeature([BannerEntity])],
  controllers: [BannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
