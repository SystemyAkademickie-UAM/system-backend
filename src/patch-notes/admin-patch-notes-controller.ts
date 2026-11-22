import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import {
  PATCH_NOTES_MAX_FILE_BYTES,
  PATCH_NOTES_TITLE_MAX_LENGTH,
  PATCH_NOTES_VERSION_MAX_LENGTH,
} from '../constants/patch-notes-constants';
import { MAQ_SESSION_COOKIE_NAME } from '../constants/session-constants';
import { CreatePatchNoteDto } from './dto/create-patch-note.dto';
import { PatchNotesAccessService } from './patch-notes-access-service';
import type {
  PatchNoteListResponse,
  PatchNoteResponse,
} from './patch-notes-response-types';
import { PatchNotesService } from './patch-notes-service';

/**
 * Controller for super-administrators managing patch note PDF documents.
 */
@ApiTags('Admin patch notes')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@UseGuards(PatchNotesAccessService)
@Controller(['admin/patch-notes', 'documents', 'admin/documents'])
export class AdminPatchNotesController {
  constructor(
    private readonly patchNotesService: PatchNotesService,
    private readonly accessService: PatchNotesAccessService,
  ) {}

  /**
   * Uploads a new patch note PDF document (super admin only).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PATCH_NOTES_MAX_FILE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Upload a new patch note PDF document (super admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string', maxLength: PATCH_NOTES_TITLE_MAX_LENGTH },
        version: { type: 'string', maxLength: PATCH_NOTES_VERSION_MAX_LENGTH },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Patch note PDF uploaded successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async upload(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreatePatchNoteDto,
  ): Promise<PatchNoteResponse> {
    const superAdminUserId = await this.accessService.resolveSuperAdminUserId(req);
    return this.patchNotesService.createPatchNote(file, dto, superAdminUserId);
  }

  /**
   * Lists all uploaded patch notes with upload timestamps and pagination (super admin only).
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List uploaded patch notes with pagination (super admin only)' })
  @ApiOkResponse({ description: 'Paginated list of patch notes' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async list(
    @Req() req: Request,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ): Promise<PatchNoteListResponse> {
    await this.accessService.resolveSuperAdminUserId(req);
    const takeNum = take ? Number.parseInt(take, 10) : undefined;
    const skipNum = skip ? Number.parseInt(skip, 10) : undefined;
    return this.patchNotesService.listPatchNotes(takeNum, skipNum);
  }

  /**
   * Deletes a selected patch note PDF document (super admin only).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a selected patch note PDF (super admin only)' })
  @ApiOkResponse({ description: 'Patch note deleted' })
  @ApiNotFoundResponse({ description: 'Patch note not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async delete(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ deleted: boolean }> {
    await this.accessService.resolveSuperAdminUserId(req);
    return this.patchNotesService.deletePatchNote(id);
  }
}

