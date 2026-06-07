import { Controller, Get, Param, ParseIntPipe, Req, Headers, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { BacklogService } from './backlog-service';

@Controller('groups')
export class BacklogController {
  constructor(private readonly backlogService: BacklogService) {}

  /**
   * Retrieves the backlog for the specific group and the currently logged-in student.
   */
  @Get(':groupId/backlog/me')
  async getStudentBacklog(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
  ) {
    const result = await this.backlogService.getStudentBacklog(req, groupId, browserId);
    if ('error' in result) {
      throw new UnauthorizedException(result.error);
    }
    return result;
  }

  /**
   * Retrieves the entire group backlog for lecturers/admins.
   */
  @Get(':groupId/backlog')
  async getGroupBacklog(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
  ) {
    const result = await this.backlogService.getGroupBacklog(req, groupId, browserId);
    if ('error' in result) {
      throw new UnauthorizedException(result.error);
    }
    return result;
  }
}
