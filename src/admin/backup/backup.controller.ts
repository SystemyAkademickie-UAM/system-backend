import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiCookieAuth,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import {
  BACKUP_CONTENT_TYPE,
  BACKUP_FILE_EXTENSION,
  BACKUP_MAX_UPLOAD_BYTES,
} from '../../constants/backup-constants';
import { MAQ_SESSION_COOKIE_NAME } from '../../constants/session-constants';
import { AdminAccessService } from '../admin-access.service';
import type { BackupFileSummary, BackupStatusResponse } from './backup-response-types';
import { BackupService } from './backup.service';

@ApiTags('Admin backup')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@Controller(['admin/backup', 'backups', 'admin/backups'])
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(
    private readonly adminAccessService: AdminAccessService,
    private readonly backupService: BackupService,
  ) {}

  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get backup status, timestamps, and warning alerts (super admin only)' })
  @ApiOkResponse({ description: 'Backup status and statistics' })
  @ApiForbiddenResponse({ description: 'Caller is not a super admin' })
  async getStatus(@Req() req: Request): Promise<BackupStatusResponse> {
    await this.adminAccessService.assertSuperAdmin(req);
    return this.backupService.getBackupStatus();
  }

  @Post('auto-backup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Trigger an automated backup immediately on the server volume (super admin only)' })
  @ApiOkResponse({ description: 'Created backup file summary' })
  @ApiForbiddenResponse({ description: 'Caller is not a super admin' })
  async triggerAutoBackup(@Req() req: Request): Promise<BackupFileSummary> {
    await this.adminAccessService.assertSuperAdmin(req);
    this.logger.log('Super admin triggered automated database backup');
    const summary = await this.backupService.createAutoBackup();
    await this.backupService.purgeOldAutoBackups();
    return summary;
  }

  @Get('auto-backups/:filename')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Download an automated backup from the server volume (super admin only)' })
  @ApiParam({ name: 'filename', description: 'Name of the backup file (.enc)' })
  @ApiOkResponse({ description: 'Encrypted backup file stream' })
  @ApiNotFoundResponse({ description: 'Backup file not found' })
  @ApiForbiddenResponse({ description: 'Caller is not a super admin' })
  async downloadAutoBackup(
    @Req() req: Request,
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    await this.adminAccessService.assertSuperAdmin(req);
    this.logger.log(`Super admin downloading auto-backup: ${filename}`);
    const { stream, sizeBytes } = await this.backupService.getAutoBackupStream(filename);
    res.setHeader('Content-Type', BACKUP_CONTENT_TYPE);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(sizeBytes));
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(stream);
  }

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Export encrypted database backup stream (super admin only)' })
  @ApiOkResponse({ description: 'Encrypted backup file (.enc)' })
  @ApiForbiddenResponse({ description: 'Caller is not a super admin' })
  async exportBackup(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    await this.adminAccessService.assertSuperAdmin(req);
    this.logger.log('Super admin initiated database backup export');
    const stream = await this.backupService.createBackupStream();
    await this.backupService.recordManualBackup();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', BACKUP_CONTENT_TYPE);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="backup-${timestamp}${BACKUP_FILE_EXTENSION}"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(stream);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: BACKUP_MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!file.originalname.endsWith(BACKUP_FILE_EXTENSION)) {
          callback(new BadRequestException('Only .enc backup files are accepted'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Import encrypted database backup (super admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ description: 'Database restored successfully' })
  @ApiForbiddenResponse({ description: 'Caller is not a super admin' })
  async importBackup(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ restored: true; message: string }> {
    await this.adminAccessService.assertSuperAdmin(req);
    if (file === undefined || file.buffer === undefined) {
      throw new BadRequestException('No backup file provided');
    }
    this.logger.warn(`Super admin initiated database restore (${file.size} bytes)`);
    await this.backupService.restoreBackup(file.buffer);
    return { restored: true, message: 'Database restored successfully' };
  }
}
