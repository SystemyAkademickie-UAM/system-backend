import {
    Controller,
    Get,
    Patch,
    Param,
    ParseIntPipe,
    Req,
    UnauthorizedException,
    ForbiddenException,
    Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BacklogService, BacklogItemResponse } from './backlog-service';
@ApiTags('Backlog')
@Controller('groups')
  export class BacklogController {
    constructor(private readonly backlogService: BacklogService) {}

  /**
     * Retrieves the backlog for the specific group and the currently logged-in student.
     */
  @Get(':groupId/backlog/me')
  @ApiOperation({ summary: 'Get the backlog for the current student in the group' })
    async getStudentBacklog(
          @Param('groupId', ParseIntPipe) groupId: number,
          @Req() req: Request,
          @Query('take') take?: string,
          @Query('skip') skip?: string) {
          let takeNum = 50;
          if (take) {
                  const parsed = parseInt(take, 10);
                  takeNum = isNaN(parsed) ? 50 : Math.max(1, Math.min(parsed, 100));
          }

      let skipNum = 0;
          if (skip) {
                  const parsed = parseInt(skip, 10);
                  skipNum = isNaN(parsed) ? 0 : Math.max(0, parsed);
          }

      const result = await this.backlogService.getStudentBacklog(req, groupId, takeNum, skipNum);
          if ('error' in result) {
                  if (result.error.startsWith('Forbidden:')) {
                            throw new ForbiddenException(result.error);
                  }
                  throw new UnauthorizedException(result.error);
          }
          return result;
    }

  /**
     * Retrieves the entire group backlog for lecturers/admins.
     */
  @Get(':groupId/backlog')
  @ApiOperation({ summary: 'Get the entire group backlog for lecturers/admins' })
    async getGroupBacklog(
          @Param('groupId', ParseIntPipe) groupId: number,
          @Req() req: Request,
          @Query('take') take?: string,
          @Query('skip') skip?: string) {
          let takeNum = 50;
          if (take) {
                  const parsed = parseInt(take, 10);
                  takeNum = isNaN(parsed) ? 50 : Math.max(1, Math.min(parsed, 100));
          }

      let skipNum = 0;
          if (skip) {
                  const parsed = parseInt(skip, 10);
                  skipNum = isNaN(parsed) ? 0 : Math.max(0, parsed);
          }

      const result = await this.backlogService.getGroupBacklog(req, groupId, takeNum, skipNum);
          if ('error' in result) {
                  if (result.error.startsWith('Forbidden:')) {
                            throw new ForbiddenException(result.error);
                  }
                  throw new UnauthorizedException(result.error);
          }
          return result;
    }

  @Get(':groupId/backlog/unread-count')
  @ApiOperation({ summary: 'Get unread backlog count for the current user in the group' })
  async getUnreadCount(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Req() req: Request,
  ) {
    const result = await this.backlogService.getUnreadCount(req, groupId);
    if ('error' in result) {
      if (result.error.startsWith('Forbidden:')) {
        throw new ForbiddenException(result.error);
      }
      throw new UnauthorizedException(result.error);
    }
    return result;
  }

  @Get(':groupId/backlog/count')
  @ApiOperation({ summary: 'Get total backlog count for the current user in the group' })
  async getBacklogCount(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Req() req: Request,
  ) {
    const result = await this.backlogService.getBacklogCount(req, groupId);
    if ('error' in result) {
      if (result.error.startsWith('Forbidden:')) {
        throw new ForbiddenException(result.error);
      }
      throw new UnauthorizedException(result.error);
    }
    return result;
  }

  @Patch(':groupId/backlog/read-all')
  @ApiOperation({ summary: 'Mark all backlog items as read for the current user in the group' })
  async markAllAsRead(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Req() req: Request,
  ) {
    const result = await this.backlogService.markAllAsRead(req, groupId);
    if ('error' in result) {
      if (result.error.startsWith('Forbidden:')) {
        throw new ForbiddenException(result.error);
      }
      throw new UnauthorizedException(result.error);
    }
    return result;
  }

  /**
   * Marks a specific backlog entry as read.
   */
  @Patch(':groupId/backlog/:backlogId/read')
  @ApiOperation({ summary: 'Mark a backlog item as read' })
  async markAsRead(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('backlogId', ParseIntPipe) backlogId: number,
    @Req() req: Request,
  ) {
    const result = await this.backlogService.markAsRead(req, groupId, backlogId);
    if ('error' in result) {
      if (result.error.startsWith('Forbidden:')) {
        throw new ForbiddenException(result.error);
      }
      throw new UnauthorizedException(result.error);
    }
    return result;
  }
}
