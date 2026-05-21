import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { StagesService, StageResponseBody } from './stages-service';

/**
 * Stage management API for lecturers.
 * Methods: post, modify, remove, retrieve.
 */
@Controller('stages')
export class StagesController {
  constructor(private readonly stagesService: StagesService) {}

  /**
   * Handles stage operations based on the `method` field in the request body.
   * Auth is read from `maq_auth` cookie OR body `auth` field.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  handleStage(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: unknown,
  ): Promise<StageResponseBody> {
    return this.stagesService.handleStage(req, body, browserId);
  }
}
