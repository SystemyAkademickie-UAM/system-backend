import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiCookieAuth,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../../constants/session-constants';
import { AdminAccessService } from '../admin-access.service';
import { BackupService } from './backup.service';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

@ApiTags('Admin backup')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller('admin/backup')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(
    private readonly adminAccessService: AdminAccessService,
    private readonly backupService: BackupService) {}

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export encrypted database backup (super admin only)' })
  @ApiOkResponse({ description: 'Encrypted backup file (.enc)' })
  @ApiForbiddenResponse({ description: 'Caller is not a super admin' })
  async exportBackup(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.adminAccessService.assertSuperAdmin(req);

    this.logger.log('Super admin initiated database backup export');

    const encryptedBuffer = await this.backupService.createBackup();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.enc`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', encryptedBuffer.length);
    res.setHeader('Cache-Control', 'no-store');
    res.end(encryptedBuffer);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (_req, file, callback) => {
      if (!file.originalname.endsWith('.enc')) {
        callback(new BadRequestException('Only .enc backup files are accepted'), false);
        return;
      }
      callback(null, true);
    },
  }))
  @ApiOperation({ summary: 'Import encrypted database backup (super admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ description: 'Database restored successfully' })
  @ApiForbiddenResponse({ description: 'Caller is not a super admin' })
  async importBackup(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File) {
    await this.adminAccessService.assertSuperAdmin(req);

    if (!file || !file.buffer) {
      throw new BadRequestException('No backup file provided');
    }

    this.logger.warn(
      `Super admin initiated database RESTORE from file "${file.originalname}" (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
    );

    await this.backupService.restoreBackup(file.buffer);

    this.logger.log('Database restore completed successfully');

    return { restored: true, message: 'Database restored successfully' };
  }
}
