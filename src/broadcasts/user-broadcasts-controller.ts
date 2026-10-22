import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../constants/session-constants';
import { UserRolesService } from '../user-roles/user-roles-service';
import { BroadcastAccessService } from './broadcast-access-service';
import { BroadcastsService } from './broadcasts-service';
import type { BroadcastResponse } from './broadcast-response-types';

/**
 * Controller for authenticated users receiving and acknowledging broadcast announcements.
 */
@ApiTags('Broadcasts')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller('broadcasts')
export class UserBroadcastsController {
  constructor(
    private readonly broadcastsService: BroadcastsService,
    private readonly accessService: BroadcastAccessService,
    private readonly userRolesService: UserRolesService,
  ) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get active, unread broadcast announcements for the current user' })
  @ApiOkResponse({ description: 'List of active unread broadcasts' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async getMyBroadcasts(@Req() req: Request): Promise<BroadcastResponse[]> {
    const userId = await this.accessService.resolveUserId(req);
    const roles = await this.userRolesService.listRolesForUser(userId);
    return this.broadcastsService.listActiveForUser(userId, roles);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge/dismiss a broadcast announcement (mark as read)' })
  @ApiOkResponse({ description: 'Broadcast marked as read' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async markAsRead(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ read: boolean }> {
    const userId = await this.accessService.resolveUserId(req);
    return this.broadcastsService.markAsRead(userId, id);
  }
}
