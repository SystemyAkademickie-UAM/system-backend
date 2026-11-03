import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../constants/session-constants';
import {
  DOCUMENTS_CONTENT_TYPE,
  DOCUMENTS_MAX_FILE_BYTES,
  DOCUMENTS_TITLE_MAX_LENGTH,
  type SystemDocumentKey,
} from '../constants/system-documents-constants';
import { DocumentsAccessService } from './documents-access-service';
import type {
  SystemDocumentListResponse,
  SystemDocumentResponse,
} from './documents-response-types';
import { DocumentsService } from './documents-service';
import { UpsertSystemDocumentDto } from './dto/upsert-system-document.dto';
import { sendDocumentPdfResponse } from './send-document-pdf';

const UPLOAD_SCHEMA = {
  type: 'object',
  required: ['file'],
  properties: {
    file: { type: 'string', format: 'binary' },
    title: { type: 'string', maxLength: DOCUMENTS_TITLE_MAX_LENGTH },
  },
};

/**
 * Controller for super-administrators managing application PDF documents.
 */
@ApiTags('Admin documents')
@ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
@UseGuards(DocumentsAccessService)
@Controller('admin/documents')
export class AdminDocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly accessService: DocumentsAccessService,
  ) {}

  /**
   * Lists all application documents with upload timestamps and metadata (super admin only).
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all application documents and their upload status (super admin only)' })
  @ApiOkResponse({ description: 'List of application documents' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async list(@Req() req: Request): Promise<SystemDocumentListResponse> {
    await this.accessService.resolveSuperAdminUserId(req);
    return this.documentsService.listDocuments();
  }

  /**
   * Returns metadata and upload timestamp for a single application document (super admin only).
   */
  @Get(':key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get metadata of a specific application document (super admin only)' })
  @ApiOkResponse({ description: 'Application document metadata' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async getOne(
    @Req() req: Request,
    @Param('key') key: string,
  ): Promise<SystemDocumentResponse> {
    await this.accessService.resolveSuperAdminUserId(req);
    return this.documentsService.getDocument(key);
  }

  /**
   * Serves the binary PDF content of a specific application document for inspection (super admin only).
   */
  @Get(':key/file')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inspect or download a specific application document PDF (super admin only)' })
  @ApiProduces(DOCUMENTS_CONTENT_TYPE)
  @ApiOkResponse({ description: 'Application document PDF binary' })
  @ApiNotFoundResponse({ description: 'Document has no uploaded file' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async getFile(
    @Req() req: Request,
    @Param('key') key: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    await this.accessService.resolveSuperAdminUserId(req);
    const payload = await this.documentsService.getDocumentFile(key);
    sendDocumentPdfResponse(res, payload, download);
  }

  /**
   * Uploads or replaces the PDF file for a specific application document via PUT (super admin only).
   */
  @Put(':key')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: DOCUMENTS_MAX_FILE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Upload or replace an application document PDF (super admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: UPLOAD_SCHEMA })
  @ApiOkResponse({ description: 'Document uploaded or replaced successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async replace(
    @Req() req: Request,
    @Param('key') key: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UpsertSystemDocumentDto,
  ): Promise<SystemDocumentResponse> {
    const superAdminUserId = await this.accessService.resolveSuperAdminUserId(req);
    return this.documentsService.upsertDocument(key, file, dto, superAdminUserId);
  }

  /**
   * Uploads or replaces the PDF file for a specific application document via POST (super admin only).
   */
  @Post(':key')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: DOCUMENTS_MAX_FILE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Upload or replace an application document PDF via POST (super admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: UPLOAD_SCHEMA })
  @ApiOkResponse({ description: 'Document uploaded or replaced successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async upload(
    @Req() req: Request,
    @Param('key') key: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UpsertSystemDocumentDto,
  ): Promise<SystemDocumentResponse> {
    const superAdminUserId = await this.accessService.resolveSuperAdminUserId(req);
    return this.documentsService.upsertDocument(key, file, dto, superAdminUserId);
  }

  /**
   * Deletes the stored PDF file for a specific application document (super admin only).
   */
  @Delete(':key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an uploaded application document PDF (super admin only)' })
  @ApiOkResponse({ description: 'Document PDF deleted' })
  @ApiNotFoundResponse({ description: 'Document has no uploaded file' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Requires super role' })
  async delete(
    @Req() req: Request,
    @Param('key') key: string,
  ): Promise<{ deleted: boolean; key: SystemDocumentKey }> {
    await this.accessService.resolveSuperAdminUserId(req);
    return this.documentsService.deleteDocument(key);
  }
}

