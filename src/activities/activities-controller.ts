import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { ActivitiesService, ActivityResponseBody } from './activities-service';

/**
 * Activity management API for lecturers.
 * Methods: post, modify, remove, retrieve.
 */
@ApiTags('Activities')
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  /**
   * Handles activity operations based on the `method` field in the request body.
   * Auth is read from `maq_auth` cookie OR body `auth` field.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle activity operations based on the request body method field' })
  handleActivity(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: unknown,
  ): Promise<ActivityResponseBody> {
    return this.activitiesService.handleActivity(req, body, browserId);
  }
}
