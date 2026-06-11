import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ShopTemplatesService } from './shop-templates-service';

@ApiTags('Shop templates')
@Controller('shop-templates')
export class ShopTemplatesController {
  constructor(private readonly shopTemplatesService: ShopTemplatesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get default shop templates' })
  getTemplates() {
    return this.shopTemplatesService.getDefaultTemplates();
  }
}
