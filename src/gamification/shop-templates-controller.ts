import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ShopTemplatesService } from './shop-templates-service';

@Controller('shop-templates')
export class ShopTemplatesController {
  constructor(private readonly shopTemplatesService: ShopTemplatesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getTemplates() {
    return this.shopTemplatesService.getDefaultTemplates();
  }
}
