import { randomUUID } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { BadRequestException, Injectable } from '@nestjs/common';

import {
  DRIVE_API_JSON_STATUS_FORBIDDEN,
  DRIVE_API_JSON_STATUS_OK,
} from '../constants/drive-api-constants';
import {
  DRIVE_DEFAULT_ORGANIZATION_ID,
  resolveDriveStorageRoot,
} from '../constants/drive-storage-constants';
import { LecturerSessionAuthService } from '../lecturer-auth/lecturer-session-auth-service';

type DriveHttpMethod = 'post' | 'remove';

type DriveCommandPayload = {
  auth: string;
  drive: {
    method: DriveHttpMethod;
    driveRef: string;
    size: number;
    organizationId?: number;
  };
};

export type DriveHandleResponseBody = {
  status: number;
  method: DriveHttpMethod;
  driveRef: string;
  size: number;
};

type DriveHandleInput = {
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
  if (typeof authValue !== 'string' || !isRecord(driveValue)) {
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
    auth: authValue,
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

/**
 * Stores banner binaries under `<DRIVE_STORAGE_ROOT>/drive/<organizationId>/<uuid>` and removes them on request.
 */
@Injectable()
export class DriveService {
  constructor(private readonly lecturerSessionAuthService: LecturerSessionAuthService) {}

  async handleDrive(input: DriveHandleInput): Promise<DriveHandleResponseBody> {
    const payload = parseDriveCommandJson(input.jsonField);
    if (!payload) {
      throw new BadRequestException('json form field must be a valid JSON string');
    }
    const session = await this.lecturerSessionAuthService.tryGetLecturerSession(
      payload.auth,
      input.browserIdHeader,
    );
    const organizationId = resolveOrganizationId(payload);
    if (!session) {
      return {
        status: DRIVE_API_JSON_STATUS_FORBIDDEN,
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
      status: DRIVE_API_JSON_STATUS_OK,
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
      status: DRIVE_API_JSON_STATUS_OK,
      method: 'remove',
      driveRef: trimmedRef,
      size: 0,
    };
  }
}
