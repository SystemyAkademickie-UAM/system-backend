import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Req } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../../constants/session-constants';
import { ExportProductionLogsDto } from './dto/export-production-logs.dto';
import { UpdateLogRetentionDto } from './dto/update-log-retention.dto';
import { ProductionLogsService } from './production-logs.service';

@ApiTags('Admin production logs')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller(['admin/logs', 'logs', 'admin/system-logs'])
export class ProductionLogsController {
  constructor(private readonly productionLogsService: ProductionLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List dated production log files (super role)' })
  @ApiOkResponse({ description: 'Calendar dates that have live or archived logs' })
  @ApiForbiddenResponse({ description: 'Caller lacks super role' })
  listDays(@Req() req: Request) {
    return this.productionLogsService.listDays(req);
  }

  @Get('retention')
  @ApiOperation({ summary: 'Get production log retention policy in days (super role)' })
  @ApiOkResponse({ description: 'Configured retention in days and default' })
  @ApiForbiddenResponse({ description: 'Caller lacks super role' })
  getRetention(@Req() req: Request) {
    return this.productionLogsService.getRetention(req);
  }

  @Put('retention')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update production log retention policy in days (super role)' })
  @ApiOkResponse({ description: 'Updated retention in days and default' })
  @ApiForbiddenResponse({ description: 'Caller lacks super role' })
  updateRetention(@Req() req: Request, @Body() dto: UpdateLogRetentionDto) {
    return this.productionLogsService.updateRetention(req, dto.ttlDays);
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Export one day of logs as ECDH+AES-GCM ciphertext (super role)',
    description:
      'Body is not plaintext. The browser derives the AES key from ECDH (P-256) and decrypts locally.',
  })
  @ApiOkResponse({ description: 'Encrypted log payload' })
  @ApiForbiddenResponse({ description: 'Caller lacks super role' })
  exportLogs(@Req() req: Request, @Body() dto: ExportProductionLogsDto) {
    return this.productionLogsService.exportEncrypted(
      req,
      dto.clientPublicKey,
      dto.day,
      dto.auth,
      dto.organizationId,
    );
  }
}
