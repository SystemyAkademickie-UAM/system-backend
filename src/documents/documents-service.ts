import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
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
  PublicSystemDocumentListResponse,
  PublicSystemDocumentResponse,
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

function stripInternalMetadata(
  response: SystemDocumentResponse,
): PublicSystemDocumentResponse {
  return {
    key: response.key,
    title: response.title,
    canonicalFilename: response.canonicalFilename,
    isUploaded: response.isUploaded,
    originalFilename: response.originalFilename,
    fileSizeBytes: response.fileSizeBytes,
    uploadedAt: response.uploadedAt,
    fileUrl: response.fileUrl,
  };
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
   * Lists all application documents with their upload status, timestamps, and uploader IDs for super-administrators.
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
   * Lists all application documents for public users without internal uploader user IDs.
   */
  async listPublicDocuments(): Promise<PublicSystemDocumentListResponse> {
    const adminList = await this.listDocuments();
    return { items: adminList.items.map(stripInternalMetadata) };
  }

  /**
   * Returns metadata and upload status for a single application document by key for super-administrators.
   */
  async getDocument(rawKey: string): Promise<SystemDocumentResponse> {
    const definition = requireDocumentDefinition(rawKey);
    const entity = await this.documentRepository.findOne({
      where: { documentKey: definition.key },
    });
    return this.buildDocumentResponse(definition, entity);
  }

  /**
   * Returns public metadata for a single application document without internal uploader user ID.
   */
  async getPublicDocument(rawKey: string): Promise<PublicSystemDocumentResponse> {
    const response = await this.getDocument(rawKey);
    return stripInternalMetadata(response);
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
    const tempPath = await this.stageTempDocumentFile(definition, validFile.buffer);
    const saved = await this.saveAndCommitStagedFile(tempPath, {
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
   * Reads the binary PDF content of a given application document when its database record exists.
   */
  async getDocumentFile(rawKey: string): Promise<SystemDocumentFilePayload> {
    const definition = requireDocumentDefinition(rawKey);
    const entity = await this.documentRepository.findOne({
      where: { documentKey: definition.key },
    });
    if (!entity) {
      throw new NotFoundException(
        `Document "${definition.key}" has no uploaded PDF file`,
      );
    }
    const filePath = buildCanonicalFilePath(definition);
    try {
      const buffer = await readFile(filePath);
      const filename = sanitizeOriginalFilename(
        entity.originalFilename,
        definition.canonicalFilename,
      );
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
    await this.removeDiskFileVerified(definition);
    if (existing) {
      await this.documentRepository.delete({ id: existing.id });
    }
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

  private async stageTempDocumentFile(
    definition: SystemDocumentDefinition,
    buffer: Buffer,
  ): Promise<string> {
    const storageDir = resolveDocumentsStorageDir();
    await mkdir(storageDir, { recursive: true });
    const targetPath = buildCanonicalFilePath(definition);
    const tempPath = `${targetPath}.tmp`;
    try {
      await writeFile(tempPath, buffer);
      return tempPath;
    } catch (err: unknown) {
      await unlink(tempPath).catch(() => {});
      throw err;
    }
  }

  private async saveAndCommitStagedFile(
    tempPath: string,
    input: {
      existing: SystemDocumentEntity | null;
      definition: SystemDocumentDefinition;
      title: string;
      originalFilename: string;
      fileSizeBytes: number;
      superAdminUserId: number;
    },
  ): Promise<SystemDocumentEntity> {
    const targetPath = buildCanonicalFilePath(input.definition);
    try {
      const saved = await this.saveDocumentEntity(input);
      await rename(tempPath, targetPath);
      return saved;
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
    return this.documentRepository.save(record);
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

  private async removeDiskFileVerified(
    definition: SystemDocumentDefinition,
  ): Promise<void> {
    try {
      await unlink(buildCanonicalFilePath(definition));
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException | undefined)?.code;
      if (code && code !== 'ENOENT') {
        throw new InternalServerErrorException(
          `Failed to delete PDF file for document "${definition.key}"`,
        );
      }
    }
    if ((await this.readDiskStat(definition)) !== null) {
      throw new InternalServerErrorException(
        `Failed to delete PDF file for document "${definition.key}"`,
      );
    }
  }

  private async buildDocumentResponse(
    definition: SystemDocumentDefinition,
    entity: SystemDocumentEntity | null,
  ): Promise<SystemDocumentResponse> {
    const diskStat = await this.readDiskStat(definition);
    const isUploaded = entity !== null && diskStat !== null;
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
      entity.uploadedAt instanceof Date
        ? entity.uploadedAt.toISOString()
        : diskStat.mtimeIso;
    return {
      key: definition.key,
      title: entity.title,
      canonicalFilename: definition.canonicalFilename,
      isUploaded: true,
      originalFilename: entity.originalFilename,
      fileSizeBytes: diskStat.sizeBytes,
      uploadedAt: uploadedAtIso,
      uploadedByUserId: entity.uploadedByUserId,
      fileUrl: `/api/documents/${definition.key}/file`,
    };
  }
}
