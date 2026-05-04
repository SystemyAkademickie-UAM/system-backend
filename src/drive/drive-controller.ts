import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';

import { DRIVE_MAX_FILE_BYTES } from '../constants/drive-storage-constants';
import { DriveHandleResponseBody, DriveService } from './drive-service';

type MulterBannerFiles = {
  banner?: Express.Multer.File[];
};

/**
 * Multipart drive API for lecturers (`banner` + stringified JSON in `json`).
 */
@Controller('drive')
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  /**
   * Accepts `multipart/form-data` with `json` (string) and optional `banner` file bytes.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'banner', maxCount: 1 }], { limits: { fileSize: DRIVE_MAX_FILE_BYTES } }),
  )
  handleDrive(
    @Req() req: Request,
    @Headers('x-browser-id') browserIdHeader: string | undefined,
  ): Promise<DriveHandleResponseBody> {
    const files = req.files as MulterBannerFiles | undefined;
    const bannerFile = files?.banner?.[0];
    return this.driveService.handleDrive({
      jsonField: req.body?.['json'],
      bannerFile,
      browserIdHeader,
    });
  }
}
