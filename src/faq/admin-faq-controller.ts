import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../constants/session-constants';
import { CreateFaqDto } from './dto/create-faq.dto';
import { ReorderFaqsDto } from './dto/reorder-faqs.dto';
import { ReplaceAllFaqsDto } from './dto/replace-all-faqs.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { FaqAccessService } from './faq-access-service';
import type { FaqDeleteResponse, FaqItemResponse } from './faq-response-types';
import { FaqService } from './faq-service';

/**
 * Controller for super-administrators managing FAQ knowledge base entries.
 */
@ApiTags('Admin FAQ')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@UseGuards(FaqAccessService)
@Controller('admin/faq')
export class AdminFaqController {
  constructor(
    private readonly faqService: FaqService,
    private readonly accessService: FaqAccessService,
  ) {}

  /**
   * Lists all FAQ entries with optional category and search filters.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all FAQ entries (super admin only)' })
  @ApiOkResponse({ description: 'List of FAQ entries' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async list(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ): Promise<FaqItemResponse[]> {
    return this.faqService.listAdminFaqs({ category, search });
  }

  /**
   * Retrieves a single FAQ entry by its identifier.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single FAQ entry by ID (super admin only)' })
  @ApiOkResponse({ description: 'FAQ entry details' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async getOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FaqItemResponse> {
    return this.faqService.getFaqById(id);
  }

  /**
   * Creates a new FAQ entry.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new FAQ entry (super admin only)' })
  @ApiOkResponse({ description: 'FAQ entry created successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async create(
    @Req() req: Request,
    @Body() dto: CreateFaqDto,
  ): Promise<FaqItemResponse> {
    const superAdminUserId = await this.accessService.resolveSuperAdminUserId(req);
    return this.faqService.createFaq(dto, superAdminUserId);
  }

  /**
   * Replaces the entire FAQ page entries list in one save operation.
   */
  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replace all FAQ entries on page save (super admin only)' })
  @ApiOkResponse({ description: 'FAQ page entries saved successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async replaceAll(
    @Req() req: Request,
    @Body() dto: ReplaceAllFaqsDto,
  ): Promise<FaqItemResponse[]> {
    const superAdminUserId = await this.accessService.resolveSuperAdminUserId(req);
    return this.faqService.replaceAllFaqs(dto, superAdminUserId);
  }

  /**
   * Updates an existing FAQ entry.
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an existing FAQ entry (super admin only)' })
  @ApiOkResponse({ description: 'FAQ entry updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Body() dto: UpdateFaqDto,
  ): Promise<FaqItemResponse> {
    const superAdminUserId = await this.accessService.resolveSuperAdminUserId(req);
    return this.faqService.updateFaq(id, dto, superAdminUserId);
  }

  /**
   * Batch updates ordering indices for FAQ entries.
   */
  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch reorder FAQ entries (super admin only)' })
  @ApiOkResponse({ description: 'FAQ entries reordered successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async reorder(
    @Req() req: Request,
    @Body() dto: ReorderFaqsDto,
  ): Promise<FaqItemResponse[]> {
    const superAdminUserId = await this.accessService.resolveSuperAdminUserId(req);
    return this.faqService.reorderFaqs(dto, superAdminUserId);
  }

  /**
   * Deletes an FAQ entry by its identifier.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an FAQ entry (super admin only)' })
  @ApiOkResponse({ description: 'FAQ entry deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async delete(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FaqDeleteResponse> {
    return this.faqService.deleteFaq(id);
  }
}
