import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type {
  FaqGroupedCategoryResponse,
  PublicFaqItemResponse,
} from './faq-response-types';
import { FaqService } from './faq-service';

/**
 * Controller providing read access to published FAQ entries.
 */
@ApiTags('FAQ')
@Controller('faq')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  /**
   * Lists published FAQ entries, optionally filtered by category or grouped by category.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List published FAQ entries' })
  @ApiOkResponse({ description: 'List of published FAQ entries or grouped categories' })
  async list(
    @Query('category') category?: string,
    @Query('grouped') grouped?: string,
  ): Promise<PublicFaqItemResponse[] | FaqGroupedCategoryResponse[]> {
    if (grouped === '1' || grouped === 'true') {
      return this.faqService.listGroupedPublicFaqs();
    }
    return this.faqService.listPublicFaqs(category);
  }

  /**
   * Retrieves a single published FAQ entry by ID.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single published FAQ entry by ID' })
  @ApiOkResponse({ description: 'FAQ entry details' })
  async getOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PublicFaqItemResponse> {
    return this.faqService.getPublicFaqById(id);
  }
}
