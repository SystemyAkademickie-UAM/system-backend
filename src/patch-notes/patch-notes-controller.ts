import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import {
  PATCH_NOTES_CACHE_MAX_AGE_SECONDS,
  PATCH_NOTES_CONTENT_TYPE,
} from '../constants/patch-notes-constants';
import type {
  PatchNoteFilePayload,
  PatchNoteListResponse,
  PatchNoteResponse,
} from './patch-notes-response-types';
import { PatchNotesService } from './patch-notes-service';

function resolveContentDisposition(
  filename: string,
  downloadQuery: string | undefined,
): string {
  const isAttachment = downloadQuery === '1' || downloadQuery === 'true';
  const mode = isAttachment ? 'attachment' : 'inline';
  const asciiFilename = filename.replace(/[^\x20-\x7e]/g, '_');
  const encodedFilename = encodeURIComponent(filename);
  return `${mode}; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;
}

function sendPdfPayload(
  res: Response,
  payload: PatchNoteFilePayload,
  downloadQuery: string | undefined,
  cacheControl: string,
): void {
  res.set({
    'Content-Type': payload.contentType,
    'Content-Disposition': resolveContentDisposition(payload.filename, downloadQuery),
    'Content-Length': String(payload.sizeBytes),
    'Cache-Control': cacheControl,
  });
  res.send(payload.buffer);
}

/**
 * Public controller exposing patch notes history and PDF documents to users on application pages.
 */
@ApiTags('Patch notes')
@Controller('patch-notes')
export class PatchNotesController {
  constructor(private readonly patchNotesService: PatchNotesService) {}

  /**
   * Lists available patch notes ordered from newest to oldest.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List available patch notes ordered from newest to oldest' })
  @ApiOkResponse({ description: 'Paginated list of patch notes' })
  async list(
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ): Promise<PatchNoteListResponse> {
    const takeNum = take ? Number.parseInt(take, 10) : undefined;
    const skipNum = skip ? Number.parseInt(skip, 10) : undefined;
    return this.patchNotesService.listPatchNotes(takeNum, skipNum);
  }

  /**
   * Returns metadata for the latest uploaded patch note.
   */
  @Get('latest')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get metadata of the latest uploaded patch note' })
  @ApiOkResponse({ description: 'Latest patch note metadata' })
  @ApiNotFoundResponse({ description: 'No patch notes uploaded yet' })
  async getLatest(): Promise<PatchNoteResponse> {
    return this.patchNotesService.getLatestPatchNote();
  }

  /**
   * Serves the PDF binary of the latest uploaded patch note.
   */
  @Get('latest/file')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Serve the latest uploaded patch note PDF document' })
  @ApiProduces(PATCH_NOTES_CONTENT_TYPE)
  @ApiOkResponse({ description: 'Latest patch note PDF binary' })
  @ApiNotFoundResponse({ description: 'No patch notes uploaded yet' })
  async getLatestFile(
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const payload = await this.patchNotesService.getLatestPatchNoteFile();
    sendPdfPayload(res, payload, download, 'no-cache');
  }

  /**
   * Serves the PDF binary of a specific patch note by its identifier.
   */
  @Get(':id/file')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Serve a specific patch note PDF document by id' })
  @ApiProduces(PATCH_NOTES_CONTENT_TYPE)
  @ApiOkResponse({ description: 'Patch note PDF binary' })
  @ApiNotFoundResponse({ description: 'Patch note not found' })
  async getFileById(
    @Param('id', ParseIntPipe) id: number,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const payload = await this.patchNotesService.getPatchNoteFileById(id);
    sendPdfPayload(
      res,
      payload,
      download,
      `public, max-age=${PATCH_NOTES_CACHE_MAX_AGE_SECONDS}`,
    );
  }
}
