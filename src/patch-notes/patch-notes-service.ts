import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  PATCH_NOTES_CONTENT_TYPE,
  PATCH_NOTES_FILENAME_MAX_LENGTH,
  PATCH_NOTES_FILE_EXTENSION,
  PATCH_NOTES_LIST_DEFAULT_TAKE,
  PATCH_NOTES_LIST_MAX_TAKE,
  PATCH_NOTES_MAX_FILE_BYTES,
  PATCH_NOTES_TITLE_MAX_LENGTH,
  PATCH_NOTES_VERSION_MAX_LENGTH,
  PDF_MAGIC_HEADER,
  resolvePatchNotesStorageDir,
} from '../constants/patch-notes-constants';
import { PatchNoteEntity } from '../database/entities/patch-note.entity';
import { CreatePatchNoteDto } from './dto/create-patch-note.dto';
import type {
  PatchNoteFilePayload,
  PatchNoteListResponse,
  PatchNoteResponse,
} from './patch-notes-response-types';

const STORAGE_KEY_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

function isValidPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < PDF_MAGIC_HEADER.length) {
    return false;
  }
  return buffer.subarray(0, PDF_MAGIC_HEADER.length).toString('ascii') === PDF_MAGIC_HEADER;
}

function sanitizeOriginalFilename(rawName: string): string {
  const base = basename(rawName || 'patch-notes.pdf')
    .replace(/[\r\n"\\<>|?*:\x00-\x1f]/g, '_')
    .trim();
  const stem = base.toLowerCase().endsWith(PATCH_NOTES_FILE_EXTENSION)
    ? base.slice(0, -PATCH_NOTES_FILE_EXTENSION.length)
    : base;
  const maxStemLength = PATCH_NOTES_FILENAME_MAX_LENGTH - PATCH_NOTES_FILE_EXTENSION.length;
  const safeStem = (stem.trim() || 'patch-notes').slice(0, maxStemLength);
  return `${safeStem}${PATCH_NOTES_FILE_EXTENSION}`;
}

function deriveDefaultTitle(filename: string): string {
  const withoutExt = filename.replace(/\.pdf$/i, '').trim();
  const fallback = withoutExt.length > 0 ? withoutExt : 'Patch notes';
  return fallback.slice(0, PATCH_NOTES_TITLE_MAX_LENGTH);
}

function resolveTitle(dtoTitle: string | undefined, filename: string): string {
  const trimmed = dtoTitle?.trim();
  if (trimmed && trimmed.length > 0) {
    if (trimmed.length > PATCH_NOTES_TITLE_MAX_LENGTH) {
      throw new BadRequestException(
        `Title must not exceed ${PATCH_NOTES_TITLE_MAX_LENGTH} characters`,
      );
    }
    return trimmed;
  }
  return deriveDefaultTitle(filename);
}

function resolveVersion(dtoVersion: string | undefined): string | null {
  if (dtoVersion === undefined || dtoVersion === null) {
    return null;
  }
  const trimmed = dtoVersion.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > PATCH_NOTES_VERSION_MAX_LENGTH) {
    throw new BadRequestException(
      `Version must not exceed ${PATCH_NOTES_VERSION_MAX_LENGTH} characters`,
    );
  }
  return trimmed;
}

function buildAbsoluteStoragePath(storageKey: string): string {
  if (!STORAGE_KEY_REGEX.test(storageKey)) {
    throw new BadRequestException('Invalid patch note storage key');
  }
  return join(resolvePatchNotesStorageDir(), storageKey);
}

/**
 * Domain service managing platform patch notes PDF documents.
 */
@Injectable()
export class PatchNotesService {
  constructor(
    @InjectRepository(PatchNoteEntity)
    private readonly patchNoteRepository: Repository<PatchNoteEntity>,
  ) {}

  /**
   * Validates, stores on disk, and persists metadata for a newly uploaded patch note PDF.
   */
  async createPatchNote(
    file: Express.Multer.File | undefined,
    dto: CreatePatchNoteDto,
    superAdminUserId: number,
  ): Promise<PatchNoteResponse> {
    const validFile = this.validateUploadedPdf(file);
    const originalFilename = sanitizeOriginalFilename(validFile.originalname);
    const title = resolveTitle(dto.title, originalFilename);
    const version = resolveVersion(dto.version);
    const storageKey = `${randomUUID()}${PATCH_NOTES_FILE_EXTENSION}`;
    await this.writePdfFileAtomically(storageKey, validFile.buffer);
    return this.savePatchNoteRecord({
      title,
      version,
      originalFilename,
      storageKey,
      fileSizeBytes: validFile.buffer.length,
      uploadedByUserId: superAdminUserId,
    });
  }

  /**
   * Lists uploaded patch notes ordered from newest to oldest with pagination.
   */
  async listPatchNotes(
    takeRaw?: number,
    skipRaw?: number,
  ): Promise<PatchNoteListResponse> {
    const takeInput =
      takeRaw !== undefined && Number.isFinite(takeRaw)
        ? takeRaw
        : PATCH_NOTES_LIST_DEFAULT_TAKE;
    const skipInput =
      skipRaw !== undefined && Number.isFinite(skipRaw) ? skipRaw : 0;
    const take = Math.max(1, Math.min(takeInput, PATCH_NOTES_LIST_MAX_TAKE));
    const skip = Math.max(0, skipInput);
    const [rows, total] = await this.patchNoteRepository.findAndCount({
      order: { createdAt: 'DESC', id: 'DESC' },
      take,
      skip,
    });
    return {
      items: rows.map((row) => this.mapPatchNote(row)),
      total,
    };
  }

  /**
   * Returns metadata for the most recently uploaded patch note PDF.
   */
  async getLatestPatchNote(): Promise<PatchNoteResponse> {
    const latest = await this.findLatestEntity();
    return this.mapPatchNote(latest);
  }

  /**
   * Reads the PDF binary for a specific patch note by its identifier.
   */
  async getPatchNoteFileById(patchNoteId: number): Promise<PatchNoteFilePayload> {
    const entity = await this.patchNoteRepository.findOne({
      where: { id: patchNoteId },
    });
    if (!entity) {
      throw new NotFoundException(`Patch note with id ${patchNoteId} not found`);
    }
    return this.readStoredPdfFile(entity);
  }

  /**
   * Reads the PDF binary for the most recently uploaded patch note.
   */
  async getLatestPatchNoteFile(): Promise<PatchNoteFilePayload> {
    const latest = await this.findLatestEntity();
    return this.readStoredPdfFile(latest);
  }

  /**
   * Deletes a patch note record and removes its stored PDF file from disk.
   */
  async deletePatchNote(patchNoteId: number): Promise<{ deleted: boolean }> {
    const existing = await this.patchNoteRepository.findOne({
      where: { id: patchNoteId },
    });
    if (!existing) {
      throw new NotFoundException(`Patch note with id ${patchNoteId} not found`);
    }
    await this.patchNoteRepository.delete({ id: patchNoteId });
    await this.removeFileQuietly(existing.storageKey);
    return { deleted: true };
  }

  private validateUploadedPdf(
    file: Express.Multer.File | undefined,
  ): Express.Multer.File {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('A non-empty PDF file is required');
    }
    if (file.buffer.length > PATCH_NOTES_MAX_FILE_BYTES) {
      throw new BadRequestException('PDF file exceeds maximum allowed size');
    }
    const hasPdfExtension = (file.originalname ?? '')
      .toLowerCase()
      .endsWith(PATCH_NOTES_FILE_EXTENSION);
    const hasPdfMime = file.mimetype === PATCH_NOTES_CONTENT_TYPE;
    if ((!hasPdfExtension && !hasPdfMime) || !isValidPdfBuffer(file.buffer)) {
      throw new BadRequestException('Uploaded file must be a valid PDF document');
    }
    return file;
  }

  private async writePdfFileAtomically(
    storageKey: string,
    buffer: Buffer,
  ): Promise<void> {
    const storageDir = resolvePatchNotesStorageDir();
    await mkdir(storageDir, { recursive: true });
    const targetPath = buildAbsoluteStoragePath(storageKey);
    const tempPath = `${targetPath}.tmp`;
    try {
      await writeFile(tempPath, buffer);
      await rename(tempPath, targetPath);
    } catch (err: unknown) {
      await unlink(tempPath).catch(() => {});
      throw err;
    }
  }

  private async savePatchNoteRecord(
    data: Omit<PatchNoteEntity, 'id' | 'createdAt'>,
  ): Promise<PatchNoteResponse> {
    try {
      const entity = this.patchNoteRepository.create(data);
      const saved = await this.patchNoteRepository.save(entity);
      return this.mapPatchNote(saved);
    } catch (err: unknown) {
      await this.removeFileQuietly(data.storageKey);
      throw err;
    }
  }

  private async findLatestEntity(): Promise<PatchNoteEntity> {
    const rows = await this.patchNoteRepository.find({
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 1,
    });
    const latest = rows[0];
    if (!latest) {
      throw new NotFoundException('No patch notes found');
    }
    return latest;
  }

  private async readStoredPdfFile(
    entity: PatchNoteEntity,
  ): Promise<PatchNoteFilePayload> {
    const filePath = buildAbsoluteStoragePath(entity.storageKey);
    try {
      const buffer = await readFile(filePath);
      return {
        buffer,
        filename: sanitizeOriginalFilename(entity.originalFilename),
        contentType: PATCH_NOTES_CONTENT_TYPE,
        sizeBytes: buffer.length,
      };
    } catch {
      throw new NotFoundException('Patch note PDF file not found on storage');
    }
  }

  private async removeFileQuietly(storageKey: string): Promise<void> {
    try {
      const filePath = buildAbsoluteStoragePath(storageKey);
      await unlink(filePath);
    } catch {
      // Ignore missing file on disk during cleanup
    }
  }

  private mapPatchNote(entity: PatchNoteEntity): PatchNoteResponse {
    return {
      id: entity.id,
      title: entity.title,
      version: entity.version ?? null,
      originalFilename: entity.originalFilename,
      fileSizeBytes: entity.fileSizeBytes,
      uploadedByUserId: entity.uploadedByUserId ?? null,
      createdAt:
        entity.createdAt instanceof Date
          ? entity.createdAt.toISOString()
          : new Date().toISOString(),
      fileUrl: `/api/patch-notes/${entity.id}/file`,
    };
  }
}

