import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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

import { DOCUMENTS_CONTENT_TYPE } from '../constants/system-documents-constants';
import type {
  PublicSystemDocumentListResponse,
  PublicSystemDocumentResponse,
} from './documents-response-types';
import { DocumentsService } from './documents-service';
import { sendDocumentPdfResponse } from './send-document-pdf';

/**
 * Public controller exposing application legal and informational PDF documents to users.
 */
@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * Lists all application documents and their public upload metadata.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all application documents and their upload status' })
  @ApiOkResponse({ description: 'List of application documents' })
  async list(): Promise<PublicSystemDocumentListResponse> {
    return this.documentsService.listPublicDocuments();
  }

  /**
   * Returns public metadata for a single application document by key.
   */
  @Get(':key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get metadata of a specific application document' })
  @ApiOkResponse({ description: 'Application document metadata' })
  async getOne(@Param('key') key: string): Promise<PublicSystemDocumentResponse> {
    return this.documentsService.getPublicDocument(key);
  }

  /**
   * Serves the PDF binary of a specific application document by key.
   */
  @Get(':key/file')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Serve a specific application document PDF by key' })
  @ApiProduces(DOCUMENTS_CONTENT_TYPE)
  @ApiOkResponse({ description: 'Application document PDF binary' })
  @ApiNotFoundResponse({ description: 'Document has no uploaded file' })
  async getFile(
    @Param('key') key: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const payload = await this.documentsService.getDocumentFile(key);
    sendDocumentPdfResponse(res, payload, download);
  }
}
