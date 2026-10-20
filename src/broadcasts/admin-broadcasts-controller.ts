import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
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
import { BroadcastAccessService } from './broadcast-access-service';
import { BroadcastsService } from './broadcasts-service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import type {
  BroadcastListResponse,
  BroadcastResponse,
} from './broadcast-response-types';

/**
 * Controller for super-administrators managing broadcast announcements.
 */
@ApiTags('Admin broadcasts')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller('admin/broadcasts')
export class AdminBroadcastsController {
  constructor(
    private readonly broadcastsService: BroadcastsService,
    private readonly accessService: BroadcastAccessService,
  ) {}

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

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a broadcast announcement (super admin only)' })
  @ApiOkResponse({ description: 'Broadcast deleted' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async delete(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ deleted: boolean }> {
    await this.accessService.resolveSuperAdminUserId(req);
    return this.broadcastsService.deleteBroadcast(id);
  }
}
