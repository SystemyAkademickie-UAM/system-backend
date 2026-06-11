import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { BannerEntity } from '../database/entities/banner.entity';
import { BannersService } from './banners-service';

@ApiTags('Banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  /**
   * GET /banners
   * Returns list of all available predefined banners.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all predefined banners' })
  async getBanners(): Promise<BannerEntity[]> {
    return this.bannersService.getBanners();
  }
}
