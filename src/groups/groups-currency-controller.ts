import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
@ApiTags('Group currency')
@Controller('groups')
export class GroupsCurrencyController {
  constructor(private readonly groupsCurrencyService: GroupsCurrencyService) {}

  /**
   * Returns the current currency settings for a group.
   * GET /groups/:groupId/currency
   */
  @Get(':groupId/currency')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the current currency settings for a group' })
  getCurrencySettings(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
  ): Promise<GetCurrencyResponseBody> {
    return this.groupsCurrencyService.getCurrencySettings(req, publicGroupId);
  }

  /**
   * Updates the currency name and/or icon for a group.
   * PATCH /groups/:groupId/currency
   */
  @Patch(':groupId/currency')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update the currency name and/or icon for a group' })
  updateCurrencySettings(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Body() body: UpdateCurrencyDto): Promise<UpdateCurrencyResponseBody> {
    return this.groupsCurrencyService.updateCurrencySettings(req, publicGroupId, body);
  }
}
