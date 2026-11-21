import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, open, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import { DriveEntity } from '../database/entities/drive.entity';
import {
  DRIVE_API_JSON_STATUS_FORBIDDEN,
  DRIVE_API_JSON_STATUS_OK,
  DRIVE_DEFAULT_ORGANIZATION_ID,
  DRIVE_MIME_SNIFF_BYTES,
  resolveDriveStorageRoot,
} from '../constants/drive-service-constants';
import {
  ORGANIZATION_LOG_CATEGORY_ORGANIZATION,
  ORGANIZATION_LOG_FILE_KIND_FILE,
  ORGANIZATION_LOG_FILE_KIND_IMAGE,
  ORGANIZATION_LOG_KIND_FILE_REMOVED,
  ORGANIZATION_LOG_KIND_FILE_STORED,
} from '../constants/organization-log-constants';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
import { OrganizationLogService } from '../organization-log/organization-log.service';
import { UserRolesService } from '../user-roles/user-roles-service';

type DriveHttpMethod = 'post' | 'remove';

type DriveCommandPayload = {
  auth?: string;
  drive: {
    method: DriveHttpMethod;
    driveRef: string;
    size: number;
    organizationId?: number;
  };
};

export type DriveHandleResponseBody = {
  statusCode: number;
  method: DriveHttpMethod;
  driveRef: string;
  size: number;
};

type DriveHandleInput = {
  req: Request;
  jsonField: unknown;
  bannerFile: Express.Multer.File | undefined;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDriveCommandJson(raw: unknown): DriveCommandPayload | null {
  if (typeof raw !== 'string') {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) {
    return null;
  }
  const authValue = parsed['auth'];
  const driveValue = parsed['drive'];
  if (!isRecord(driveValue)) {
    return null;
  }
  if (authValue !== undefined && typeof authValue !== 'string') {
    return null;
  }
  const methodValue = driveValue['method'];
  const driveRefValue = driveValue['driveRef'];
  const sizeValue = driveValue['size'];
  const organizationIdValue = driveValue['organizationId'];
  if (methodValue !== 'post' && methodValue !== 'remove') {
    return null;
  }
  if (typeof driveRefValue !== 'string' || typeof sizeValue !== 'number' || !Number.isFinite(sizeValue)) {
    return null;
  }
  if (
    organizationIdValue !== undefined &&
    organizationIdValue !== null &&
    (typeof organizationIdValue !== 'number' || !Number.isFinite(organizationIdValue))
  ) {
    return null;
  }
  const organizationId =
    typeof organizationIdValue === 'number' && Number.isFinite(organizationIdValue)
      ? organizationIdValue
      : undefined;
  return {
    auth: typeof authValue === 'string' ? authValue : undefined,
    drive: {
      method: methodValue,
      driveRef: driveRefValue,
      size: sizeValue,
      organizationId,
    },
  };
}

function resolveOrganizationId(
  payload: DriveCommandPayload,
  subjectOrganizationId?: number | null,
): number {
  if (payload.drive.organizationId !== undefined && payload.drive.organizationId !== null) {
    return payload.drive.organizationId;
  }
  if (
    subjectOrganizationId !== undefined &&
    subjectOrganizationId !== null &&
    Number.isFinite(subjectOrganizationId) &&
    subjectOrganizationId > 0
  ) {
    return subjectOrganizationId;
  }
  return DRIVE_DEFAULT_ORGANIZATION_ID;
}

function buildAbsoluteDriveObjectPath(organizationId: number, objectId: string): string {
  return join(resolveDriveStorageRoot(), 'drive', String(organizationId), objectId);
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Detects MIME type from the first bytes of a file buffer (magic bytes).
 * Supports PNG, JPEG, GIF, and WebP formats.
 */
function detectMimeType(buffer: Buffer): string {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  if (buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

/**
 * Stores banner binaries under `<DRIVE_STORAGE_ROOT>/drive/<organizationId>/<uuid>` and removes them on request.
 */
@Injectable()
export class DriveService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    @Optional() private readonly organizationLogService?: OrganizationLogService,
    @Optional()
    @InjectRepository(DriveEntity)
    private readonly driveRepository?: Repository<DriveEntity>,
  ) { }

  async handleDrive(input: DriveHandleInput): Promise<DriveHandleResponseBody> {
    const payload = parseDriveCommandJson(input.jsonField);
    if (!payload) {
      throw new BadRequestException('json form field must be a valid JSON string');
    }
    const subject = await this.sessionService.resolveSubjectFromRequest(input.req, payload.auth);
    const organizationId = resolveOrganizationId(payload, subject?.organizationId);
    const isAllowed =
      subject !== null &&
      (await this.userRolesService.userHasRole(subject.userId, LECTURER_ROLE_NAME));
    if (!isAllowed) {
      return {
        statusCode: DRIVE_API_JSON_STATUS_FORBIDDEN,
        method: payload.drive.method,
        driveRef: '',
        size: 0,
      };
    }
    if (payload.drive.method === 'post') {
      const stored = await this.postObject(organizationId, input.bannerFile);
      await this.recordFile(
        subject?.organizationId ?? null,
        subject?.userId ?? null,
        ORGANIZATION_LOG_KIND_FILE_STORED,
        input.bannerFile?.mimetype ?? '',
        input.bannerFile?.originalname ?? stored.driveRef,
        stored.size,
      );
      return stored;
    }
    const removedFacts = await this.readStoredFacts(organizationId, payload.drive.driveRef);
    const removed = await this.removeObject(organizationId, payload.drive.driveRef);
    if (removedFacts !== null) {
      await this.recordFile(
        subject?.organizationId ?? null,
        subject?.userId ?? null,
        ORGANIZATION_LOG_KIND_FILE_REMOVED,
        removedFacts.mimeType,
        payload.drive.driveRef,
        removedFacts.size,
      );
    }
    return removed;
  }

  private async postObject(
    organizationId: number,
    bannerFile: Express.Multer.File | undefined,
  ): Promise<DriveHandleResponseBody> {
    if (!bannerFile) {
      throw new BadRequestException('banner file is required for method post');
    }
    const objectId = randomUUID();
    const absolutePath = buildAbsoluteDriveObjectPath(organizationId, objectId);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bannerFile.buffer);
    const stats = await stat(absolutePath);
    const mimeType = detectMimeType(bannerFile.buffer);

    if (this.driveRepository) {
      try {
        await this.driveRepository.save({
          ref: objectId,
          size: stats.size,
          mimeType: mimeType.slice(0, 32),
          createdAt: new Date(),
          organizationId,
        });
      } catch {
        // DB logging should not block file upload
      }
    }

    return {
      statusCode: DRIVE_API_JSON_STATUS_OK,
      method: 'post',
      driveRef: objectId,
      size: stats.size,
    };
  }

  private async removeObject(organizationId: number, driveRef: string): Promise<DriveHandleResponseBody> {
    const trimmedRef = driveRef.trim();
    if (trimmedRef === '') {
      throw new BadRequestException('drive.driveRef is required for method remove');
    }
    if (!DriveService.isValidDriveRef(trimmedRef)) {
      throw new BadRequestException('Invalid driveRef format — expected UUID v4');
    }
    const absolutePath = buildAbsoluteDriveObjectPath(organizationId, trimmedRef);
    try {
      await unlink(absolutePath);
    } catch {
      // ignore missing files — removal is idempotent for clients
    }

    if (this.driveRepository) {
      try {
        await this.driveRepository.delete({ ref: trimmedRef });
      } catch {
        // ignore DB delete failure
      }
    }

    return {
      statusCode: DRIVE_API_JSON_STATUS_OK,
      method: 'remove',
      driveRef: trimmedRef,
      size: 0,
    };
  }

  /**
   * Validates whether the given string is a valid UUID v4 drive reference.
   */
  private async readStoredFacts(
    organizationId: number,
    driveRef: string,
  ): Promise<{ size: number; mimeType: string } | null> {
    if (!DriveService.isValidDriveRef(driveRef.trim())) {
      return null;
    }
    const absolutePath = buildAbsoluteDriveObjectPath(organizationId, driveRef.trim());
    try {
      const fileStat = await stat(absolutePath);
      const handle = await open(absolutePath, 'r');
      const header = Buffer.alloc(DRIVE_MIME_SNIFF_BYTES);
      await handle.read(header, 0, DRIVE_MIME_SNIFF_BYTES, 0);
      await handle.close();
      return { size: fileStat.size, mimeType: detectMimeType(header) };
    } catch {
      return null;
    }
  }

  private async recordFile(
    organizationId: number | null,
    actorUserId: number | null,
    kind: string,
    mimeType: string,
    fileName: string,
    fileSizeBytes: number,
  ): Promise<void> {
    if (organizationId === null || actorUserId === null) {
      return;
    }
    await this.organizationLogService?.record({
      organizationId,
      category: ORGANIZATION_LOG_CATEGORY_ORGANIZATION,
      kind,
      actorUserId,
      fileKind: mimeType.startsWith('image/') ? ORGANIZATION_LOG_FILE_KIND_IMAGE : ORGANIZATION_LOG_FILE_KIND_FILE,
      fileName,
      fileSizeBytes,
    });
  }

  static isValidDriveRef(driveRef: string): boolean {
    return UUID_V4_REGEX.test(driveRef);
  }

  /**
   * Reads a stored drive object by its UUID reference and returns the raw bytes with detected MIME type.
   *
   * @param organizationId Organization segment for the storage path.
   * @param driveRef UUID v4 identifier of the stored object.
   * @returns Object containing the file buffer and detected content type.
   * @throws BadRequestException if driveRef is not a valid UUID.
   * @throws NotFoundException if the file does not exist on disk.
   */
  async serveObject(
    organizationId: number,
    driveRef: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    if (!DriveService.isValidDriveRef(driveRef)) {
      throw new BadRequestException('Invalid driveRef format — expected UUID v4');
    }

    // 1. Primary path in requested organization directory
    const primaryPath = buildAbsoluteDriveObjectPath(organizationId, driveRef);
    if (existsSync(primaryPath)) {
      const buffer = await readFile(primaryPath);
      return { buffer, contentType: detectMimeType(buffer) };
    }

    // 2. Check DriveEntity database record for actual organizationId
    if (this.driveRepository) {
      try {
        const dbRecord = await this.driveRepository.findOne({ where: { ref: driveRef } });
        if (dbRecord) {
          const dbPath = buildAbsoluteDriveObjectPath(dbRecord.organizationId, driveRef);
          if (existsSync(dbPath)) {
            const buffer = await readFile(dbPath);
            return { buffer, contentType: detectMimeType(buffer) };
          }
        }
      } catch {
        // Ignore DB query errors
      }
    }

    // 3. Check default organization folder (storage/drive/1)
    if (organizationId !== DRIVE_DEFAULT_ORGANIZATION_ID) {
      const defaultPath = buildAbsoluteDriveObjectPath(DRIVE_DEFAULT_ORGANIZATION_ID, driveRef);
      if (existsSync(defaultPath)) {
        const buffer = await readFile(defaultPath);
        return { buffer, contentType: detectMimeType(buffer) };
      }
    }

    // 4. Fallback: inspect any organization folder under storage/drive
    const driveRoot = join(resolveDriveStorageRoot(), 'drive');
    if (existsSync(driveRoot)) {
      try {
        const entries = await readdir(driveRoot, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const candidatePath = join(driveRoot, entry.name, driveRef);
            if (existsSync(candidatePath)) {
              const buffer = await readFile(candidatePath);
              return { buffer, contentType: detectMimeType(buffer) };
            }
          }
        }
      } catch {
        // Ignore filesystem iteration errors
      }
    }

    throw new NotFoundException('Drive object not found');
  }
}
