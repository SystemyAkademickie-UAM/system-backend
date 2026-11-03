import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  DOCUMENTS_CONTENT_TYPE,
  DOCUMENTS_FILENAME_MAX_LENGTH,
  DOCUMENTS_FILE_EXTENSION,
  DOCUMENTS_MAX_FILE_BYTES,
  DOCUMENTS_PDF_MAGIC_HEADER,
  DOCUMENTS_TITLE_MAX_LENGTH,
  SYSTEM_DOCUMENT_DEFINITIONS,
  type SystemDocumentDefinition,
  type SystemDocumentKey,
  resolveDocumentsStorageDir,
  resolveSystemDocumentDefinition,
} from '../constants/system-documents-constants';
import { SystemDocumentEntity } from '../database/entities/system-document.entity';
import type {
  SystemDocumentFilePayload,
  SystemDocumentListResponse,
  SystemDocumentResponse,
} from './documents-response-types';
import { UpsertSystemDocumentDto } from './dto/upsert-system-document.dto';

function isValidPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < DOCUMENTS_PDF_MAGIC_HEADER.length) {
    return false;
  }
  const header = buffer
    .subarray(0, DOCUMENTS_PDF_MAGIC_HEADER.length)
    .toString('ascii');
  return header === DOCUMENTS_PDF_MAGIC_HEADER;
}

function sanitizeOriginalFilename(rawName: string, fallbackName: string): string {
  const base = basename(rawName || fallbackName)
    .replace(/[\r\n"\\<>|?*:\x00-\x1f]/g, '_')
    .trim();
  const stem = base.toLowerCase().endsWith(DOCUMENTS_FILE_EXTENSION)
    ? base.slice(0, -DOCUMENTS_FILE_EXTENSION.length)
    : base;
  const maxStemLength = DOCUMENTS_FILENAME_MAX_LENGTH - DOCUMENTS_FILE_EXTENSION.length;
  const safeStem = (stem.trim() || 'document').slice(0, maxStemLength);
  return `${safeStem}${DOCUMENTS_FILE_EXTENSION}`;
}

function resolveTitle(
  dtoTitle: string | undefined,
  existingTitle: string | undefined,
  defaultTitle: string,
): string {
  const trimmed = dtoTitle?.trim();
  if (trimmed && trimmed.length > 0) {
    if (trimmed.length > DOCUMENTS_TITLE_MAX_LENGTH) {
      throw new BadRequestException(
        `Title must not exceed ${DOCUMENTS_TITLE_MAX_LENGTH} characters`,
      );
    }
    return trimmed;
  }
  return existingTitle ?? defaultTitle;
}

function requireDocumentDefinition(rawKey: string): SystemDocumentDefinition {
  const definition = resolveSystemDocumentDefinition(rawKey);
  if (!definition) {
    throw new BadRequestException(
      `Unsupported document key "${rawKey}". Allowed keys: termsOfUse, privacyPolicy, documentation`,
    );
  }
  return definition;
}

function buildCanonicalFilePath(definition: SystemDocumentDefinition): string {
  return join(resolveDocumentsStorageDir(), definition.canonicalFilename);
}

/**
 * Domain service managing application legal and informational PDF documents.
 */
@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(SystemDocumentEntity)
    private readonly documentRepository: Repository<SystemDocumentEntity>,
  ) {}

  /**
   * Lists all application documents with their upload status, timestamps, and file URLs.
   */
  async listDocuments(): Promise<SystemDocumentListResponse> {
    const dbRows = await this.documentRepository.find();
    const rowByKey = new Map<string, SystemDocumentEntity>(
      dbRows.map((row) => [row.documentKey, row]),
    );
    const items = await Promise.all(
      SYSTEM_DOCUMENT_DEFINITIONS.map((def) =>
        this.buildDocumentResponse(def, rowByKey.get(def.key) ?? null),
      ),
    );
    return { items };
  }

  /**
   * Returns metadata and upload status for a single application document by key.
   */
  async getDocument(rawKey: string): Promise<SystemDocumentResponse> {
    const definition = requireDocumentDefinition(rawKey);
    const entity = await this.documentRepository.findOne({
      where: { documentKey: definition.key },
    });
    return this.buildDocumentResponse(definition, entity);
  }

  /**
   * Uploads or replaces the PDF file for a given application document key.
   */
  async upsertDocument(
    rawKey: string,
    file: Express.Multer.File | undefined,
    dto: UpsertSystemDocumentDto,
    superAdminUserId: number,
  ): Promise<SystemDocumentResponse> {
    const definition = requireDocumentDefinition(rawKey);
    const validFile = this.validateUploadedPdf(file);
    const existing = await this.documentRepository.findOne({
      where: { documentKey: definition.key },
    });
    const originalFilename = sanitizeOriginalFilename(
      validFile.originalname,
      definition.canonicalFilename,
    );
    const title = resolveTitle(dto.title, existing?.title, definition.defaultTitle);
    await this.writeDocumentFileAtomically(definition, validFile.buffer);
    const saved = await this.saveDocumentEntity({
      existing,
      definition,
      title,
      originalFilename,
      fileSizeBytes: validFile.buffer.length,
      superAdminUserId,
    });
    return this.buildDocumentResponse(definition, saved);
  }

  /**
   * Reads the binary PDF content of a given application document.
   */
  async getDocumentFile(rawKey: string): Promise<SystemDocumentFilePayload> {
    const definition = requireDocumentDefinition(rawKey);
    const entity = await this.documentRepository.findOne({
      where: { documentKey: definition.key },
    });
    const filePath = buildCanonicalFilePath(definition);
    try {
      const buffer = await readFile(filePath);
      const filename = entity
        ? sanitizeOriginalFilename(entity.originalFilename, definition.canonicalFilename)
        : definition.canonicalFilename;
      return {
        buffer,
        filename,
        contentType: DOCUMENTS_CONTENT_TYPE,
        sizeBytes: buffer.length,
      };
    } catch {
      throw new NotFoundException(
        `Document "${definition.key}" has no uploaded PDF file`,
      );
    }
  }

  /**
   * Deletes the stored PDF file and metadata for a given application document key.
   */
  async deleteDocument(
    rawKey: string,
  ): Promise<{ deleted: boolean; key: SystemDocumentKey }> {
    const definition = requireDocumentDefinition(rawKey);
    const existing = await this.documentRepository.findOne({
      where: { documentKey: definition.key },
    });
    const fileExistsOnDisk = (await this.readDiskStat(definition)) !== null;
    if (!existing && !fileExistsOnDisk) {
      throw new NotFoundException(
        `Document "${definition.key}" is not currently uploaded`,
      );
    }
    if (existing) {
      await this.documentRepository.delete({ id: existing.id });
    }
    await this.removeDiskFileQuietly(definition);
    return { deleted: true, key: definition.key };
  }

  private validateUploadedPdf(
    file: Express.Multer.File | undefined,
  ): Express.Multer.File {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('A non-empty PDF file is required');
    }
    if (file.buffer.length > DOCUMENTS_MAX_FILE_BYTES) {
      throw new BadRequestException('PDF file exceeds maximum allowed size');
    }
    const hasPdfExtension = (file.originalname ?? '')
      .toLowerCase()
      .endsWith(DOCUMENTS_FILE_EXTENSION);
    const hasPdfMime = file.mimetype === DOCUMENTS_CONTENT_TYPE;
    if ((!hasPdfExtension && !hasPdfMime) || !isValidPdfBuffer(file.buffer)) {
      throw new BadRequestException('Uploaded file must be a valid PDF document');
    }
    return file;
  }

  private async writeDocumentFileAtomically(
    definition: SystemDocumentDefinition,
    buffer: Buffer,
  ): Promise<void> {
    const storageDir = resolveDocumentsStorageDir();
    await mkdir(storageDir, { recursive: true });
    const targetPath = buildCanonicalFilePath(definition);
    const tempPath = `${targetPath}.tmp`;
    try {
      await writeFile(tempPath, buffer);
      await rename(tempPath, targetPath);
    } catch (err: unknown) {
      await unlink(tempPath).catch(() => {});
      throw err;
    }
  }

  private async saveDocumentEntity(input: {
    existing: SystemDocumentEntity | null;
    definition: SystemDocumentDefinition;
    title: string;
    originalFilename: string;
    fileSizeBytes: number;
    superAdminUserId: number;
  }): Promise<SystemDocumentEntity> {
    const record = input.existing ?? this.documentRepository.create({
      documentKey: input.definition.key,
    });
    record.title = input.title;
    record.originalFilename = input.originalFilename;
    record.storageKey = input.definition.canonicalFilename;
    record.fileSizeBytes = input.fileSizeBytes;
    record.uploadedByUserId = input.superAdminUserId;
    record.uploadedAt = new Date();
    try {
      return await this.documentRepository.save(record);
    } catch (err: unknown) {
      if (!input.existing) {
        await this.removeDiskFileQuietly(input.definition);
      }
      throw err;
    }
  }

  private async readDiskStat(
    definition: SystemDocumentDefinition,
  ): Promise<{ sizeBytes: number; mtimeIso: string } | null> {
    try {
      const fileStat = await stat(buildCanonicalFilePath(definition));
      if (!fileStat.isFile() || fileStat.size <= 0) {
        return null;
      }
      return {
        sizeBytes: fileStat.size,
        mtimeIso: fileStat.mtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  private async removeDiskFileQuietly(
    definition: SystemDocumentDefinition,
  ): Promise<void> {
    try {
      await unlink(buildCanonicalFilePath(definition));
    } catch {
      // Ignore missing file on disk during cleanup
    }
  }

  private async buildDocumentResponse(
    definition: SystemDocumentDefinition,
    entity: SystemDocumentEntity | null,
  ): Promise<SystemDocumentResponse> {
    const diskStat = await this.readDiskStat(definition);
    const isUploaded = diskStat !== null;
    if (!isUploaded) {
      return {
        key: definition.key,
        title: entity?.title ?? definition.defaultTitle,
        canonicalFilename: definition.canonicalFilename,
        isUploaded: false,
        originalFilename: null,
        fileSizeBytes: null,
        uploadedAt: null,
        uploadedByUserId: null,
        fileUrl: null,
      };
    }
    const uploadedAtIso =
      entity?.uploadedAt instanceof Date
        ? entity.uploadedAt.toISOString()
        : diskStat.mtimeIso;
    return {
      key: definition.key,
      title: entity?.title ?? definition.defaultTitle,
      canonicalFilename: definition.canonicalFilename,
      isUploaded: true,
      originalFilename: entity?.originalFilename ?? definition.canonicalFilename,
      fileSizeBytes: diskStat.sizeBytes,
      uploadedAt: uploadedAtIso,
      uploadedByUserId: entity?.uploadedByUserId ?? null,
      fileUrl: `/api/documents/${definition.key}/file`,
    };
  }
}

