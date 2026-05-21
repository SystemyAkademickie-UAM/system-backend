import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { ActivitiesService, ActivityResponseBody } from './activities-service';

/**
 * Activity management API for lecturers.
 * Methods: post, modify, remove, retrieve.
 */
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  /**
   * Handles activity operations based on the `method` field in the request body.
   * Auth is read from `maq_auth` cookie OR body `auth` field.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  handleActivity(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: unknown,
  ): Promise<ActivityResponseBody> {
    return this.activitiesService.handleActivity(req, body, browserId);
  }
}
