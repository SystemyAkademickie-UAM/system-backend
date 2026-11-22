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
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../constants/session-constants';
import { BroadcastAccessService } from './broadcast-access-service';
import { BroadcastsService } from './broadcasts-service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { UpdateBroadcastDto } from './dto/update-broadcast.dto';
import type {
  BroadcastListResponse,
  BroadcastResponse,
} from './broadcast-response-types';

/**
 * Controller for super-administrators managing broadcast announcements.
 */
@ApiTags('Admin broadcasts')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller(['admin/broadcasts', 'admin/boardcasts'])
export class AdminBroadcastsController {
  constructor(
    private readonly broadcastsService: BroadcastsService,
    private readonly accessService: BroadcastAccessService,
  ) {}

  /**
   * Creates a new broadcast announcement.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new broadcast announcement (super admin only)' })
  @ApiOkResponse({ description: 'Broadcast created successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async create(
    @Req() req: Request,
    @Body() dto: CreateBroadcastDto,
  ): Promise<BroadcastResponse> {
    const superAdminUserId = await this.accessService.resolveSuperAdminUserId(req);
    return this.broadcastsService.createBroadcast(dto, superAdminUserId);
  }

  /**
   * Lists all broadcast announcements with pagination.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all broadcast announcements with pagination (super admin only)' })
  @ApiOkResponse({ description: 'List of broadcasts' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async list(
    @Req() req: Request,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ): Promise<BroadcastListResponse> {
    await this.accessService.resolveSuperAdminUserId(req);
    const takeNum = take ? Number.parseInt(take, 10) : undefined;
    const skipNum = skip ? Number.parseInt(skip, 10) : undefined;
    return this.broadcastsService.listAdminBroadcasts(takeNum, skipNum);
  }

  /**
   * Gets a single broadcast announcement by ID.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single broadcast announcement by ID (super admin only)' })
  @ApiOkResponse({ description: 'Broadcast details' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  @ApiNotFoundResponse({ description: 'Broadcast not found' })
  async getOne(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BroadcastResponse> {
    await this.accessService.resolveSuperAdminUserId(req);
    return this.broadcastsService.getBroadcastById(id);
  }

  /**
   * Replaces/updates an existing broadcast announcement via PUT.
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a broadcast announcement (super admin only)' })
  @ApiOkResponse({ description: 'Broadcast updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  @ApiNotFoundResponse({ description: 'Broadcast not found' })
  async update(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBroadcastDto,
  ): Promise<BroadcastResponse> {
    await this.accessService.resolveSuperAdminUserId(req);
    return this.broadcastsService.updateBroadcast(id, dto);
  }

  /**
   * Partially updates an existing broadcast announcement via PATCH.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Partially update a broadcast announcement (super admin only)' })
  @ApiOkResponse({ description: 'Broadcast updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  @ApiNotFoundResponse({ description: 'Broadcast not found' })
  async patch(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBroadcastDto,
  ): Promise<BroadcastResponse> {
    await this.accessService.resolveSuperAdminUserId(req);
    return this.broadcastsService.updateBroadcast(id, dto);
  }

  /**
   * Deletes a broadcast announcement by ID.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a broadcast announcement (super admin only)' })
  @ApiOkResponse({ description: 'Broadcast deleted' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  @ApiNotFoundResponse({ description: 'Broadcast not found' })
  async delete(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ deleted: boolean }> {
    await this.accessService.resolveSuperAdminUserId(req);
    return this.broadcastsService.deleteBroadcast(id);
  }
}
