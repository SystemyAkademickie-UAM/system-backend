import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { DRIVE_DEFAULT_ORGANIZATION_ID, DRIVE_MAX_FILE_BYTES } from '../constants/drive-service-constants';
import { DriveHandleResponseBody, DriveService } from './drive-service';

type MulterBannerFiles = {
  banner?: Express.Multer.File[];
};

/**
 * Multipart drive API for lecturers (`banner` + stringified JSON in `json`)
 * and public read-only access to stored objects by UUID.
 */
@ApiTags('Drive')
@Controller('drive')
export class DriveController {
  constructor(private readonly driveService: DriveService) {}

  /**
   * Serves a stored drive object (banner image) by its UUID reference.
   * Returns raw image bytes with detected Content-Type header.
   *
   * @param driveRef UUID v4 identifier of the stored object.
   * @param organizationId Optional organization ID (defaults to DRIVE_DEFAULT_ORGANIZATION_ID).
   * @param res Express response object for streaming raw bytes.
   */
  @Get(':driveRef')
  @ApiOperation({ summary: 'Serve a stored drive object by UUID' })
  async serveDriveObject(
    @Param('driveRef') driveRef: string,
    @Query('organizationId') organizationIdQuery: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const organizationId = this.parseOrganizationId(organizationIdQuery);
    const { buffer, contentType } = await this.driveService.serveObject(organizationId, driveRef);
    res.set({
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'public, max-age=86400',
    });
    res.send(buffer);
  }

  /**
   * Accepts `multipart/form-data` with `json` (string) and optional `banner` file bytes.
   */
  /**
   * Auth is read from `maq_auth` cookie OR JSON `auth` field.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'banner', maxCount: 1 }], { limits: { fileSize: DRIVE_MAX_FILE_BYTES } }),
  )
  @ApiOperation({ summary: 'Upload a banner via multipart drive request' })
  handleDrive(
    @Req() req: Request,
    @Headers('x-browser-id') browserIdHeader: string | undefined,
  ): Promise<DriveHandleResponseBody> {
    const files = req.files as MulterBannerFiles | undefined;
    const bannerFile = files?.banner?.[0];
    return this.driveService.handleDrive({
      req,
      jsonField: req.body?.['json'],
      bannerFile,
      browserIdHeader,
    });
  }

  private parseOrganizationId(raw: string | undefined): number {
    if (raw === undefined || raw === '') {
      return DRIVE_DEFAULT_ORGANIZATION_ID;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : DRIVE_DEFAULT_ORGANIZATION_ID;
  }
}
