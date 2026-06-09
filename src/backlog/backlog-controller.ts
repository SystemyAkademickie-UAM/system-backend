import {
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Req,
    Headers,
    UnauthorizedException,
    ForbiddenException,
    Query,
} from '@nestjs/common';
import type { Request } from 'express';
import { BacklogService, BacklogItemResponse } from './backlog-service';
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
          @Query('auth') auth?: string,
          @Query('take') take?: string,
          @Query('skip') skip?: string,
        ) {
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

      const result = await this.backlogService.getStudentBacklog(req, groupId, browserId, auth, takeNum, skipNum);
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
    async getGroupBacklog(
          @Param('groupId', ParseIntPipe) groupId: number,
          @Req() req: Request,
          @Headers('x-browser-id') browserId: string | undefined,
          @Query('auth') auth?: string,
          @Query('take') take?: string,
          @Query('skip') skip?: string,
        ) {
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

      const result = await this.backlogService.getGroupBacklog(req, groupId, browserId, auth, takeNum, skipNum);
          if ('error' in result) {
                  if (result.error.startsWith('Forbidden:')) {
                            throw new ForbiddenException(result.error);
                  }
                  throw new UnauthorizedException(result.error);
          }
          return result;
    }
}
