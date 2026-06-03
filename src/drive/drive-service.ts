import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import {
  DRIVE_API_JSON_STATUS_FORBIDDEN,
  DRIVE_API_JSON_STATUS_OK,
  DRIVE_DEFAULT_ORGANIZATION_ID,
  resolveDriveStorageRoot,
} from '../constants/drive-service-constants';
import { LECTURER_ROLE_NAME } from '../constants/role-name-constants';
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
  browserIdHeader: string | undefined;
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

function resolveOrganizationId(payload: DriveCommandPayload): number {
  if (payload.drive.organizationId !== undefined && payload.drive.organizationId !== null) {
    return payload.drive.organizationId;
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
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
  ) {}

  async handleDrive(input: DriveHandleInput): Promise<DriveHandleResponseBody> {
    const payload = parseDriveCommandJson(input.jsonField);
    if (!payload) {
      throw new BadRequestException('json form field must be a valid JSON string');
    }
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      input.req,
      input.browserIdHeader,
      payload.auth,
    );
    const organizationId = resolveOrganizationId(payload);
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
      return this.postObject(organizationId, input.bannerFile);
    }
    return this.removeObject(organizationId, payload.drive.driveRef);
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
    const absolutePath = buildAbsoluteDriveObjectPath(organizationId, trimmedRef);
    try {
      await unlink(absolutePath);
    } catch {
      // ignore missing files — removal is idempotent for clients
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
    const absolutePath = buildAbsoluteDriveObjectPath(organizationId, driveRef);
    let buffer: Buffer;
    try {
      buffer = await readFile(absolutePath);
    } catch {
      throw new NotFoundException('Drive object not found');
    }
    const contentType = detectMimeType(buffer);
    return { buffer, contentType };
  }
}
