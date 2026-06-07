import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

import { BannerEntity } from '../database/entities/banner.entity';
import { BannersService } from './banners-service';

@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  /**
   * GET /banners
   * Returns list of all available predefined banners.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getBanners(): Promise<BannerEntity[]> {
    return this.bannersService.getBanners();
  }
}
