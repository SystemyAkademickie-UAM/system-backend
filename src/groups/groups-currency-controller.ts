import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { UpdateCurrencyDto } from './dto/update-currency.dto';
import {
  GetCurrencyResponseBody,
  GroupsCurrencyService,
  UpdateCurrencyResponseBody,
} from './groups-currency-service';

/**
 * Currency settings API for course groups.
 * Allows lecturers to read and update the currency name and icon.
 */
@Controller('groups')
export class GroupsCurrencyController {
  constructor(private readonly groupsCurrencyService: GroupsCurrencyService) {}

  /**
   * Returns the current currency settings for a group.
   * GET /groups/:groupId/currency
   */
  @Get(':groupId/currency')
  @HttpCode(HttpStatus.OK)
  getCurrencySettings(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Query('auth') auth: string | undefined,
  ): Promise<GetCurrencyResponseBody> {
    return this.groupsCurrencyService.getCurrencySettings(req, publicGroupId, browserId, auth);
  }

  /**
   * Updates the currency name and/or icon for a group.
   * PATCH /groups/:groupId/currency
   */
  @Patch(':groupId/currency')
  @HttpCode(HttpStatus.OK)
  updateCurrencySettings(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: UpdateCurrencyDto,
  ): Promise<UpdateCurrencyResponseBody> {
    return this.groupsCurrencyService.updateCurrencySettings(req, publicGroupId, body, browserId);
  }
}
