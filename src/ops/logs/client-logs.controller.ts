import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../../constants/session-constants';
import { IngestClientLogDto } from './dto/ingest-client-log.dto';
import { ProductionLogsService } from './production-logs.service';

@ApiTags('Client production logs')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller('client-logs')
export class ClientLogsController {
  constructor(private readonly productionLogsService: ProductionLogsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Append a browser error/warn line to the daily production log' })
  @ApiOkResponse({ description: 'Line accepted' })
  @ApiForbiddenResponse({ description: 'No session' })
  ingest(@Req() req: Request, @Body() dto: IngestClientLogDto) {
    return this.productionLogsService.ingestClientLog(req, dto.level, dto.message, dto.source);
  }
}
