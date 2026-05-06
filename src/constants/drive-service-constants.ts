import { join } from 'node:path';

/** JSON `status` on successful drive `post` / `remove` responses (matches API examples). */
export const DRIVE_API_JSON_STATUS_OK = 200;

/** JSON `status` when the session is missing or not a lecturer session. */
export const DRIVE_API_JSON_STATUS_FORBIDDEN = 403;

const parsedMaxBytes = Number.parseInt(process.env.DRIVE_MAX_FILE_BYTES ?? '', 10);

/** Maximum uploaded file size in bytes (multipart `banner`). */
export const DRIVE_MAX_FILE_BYTES = Number.isFinite(parsedMaxBytes) ? parsedMaxBytes : 15 * 1024 * 1024;

const parsedDefaultOrg = Number.parseInt(process.env.DRIVE_DEFAULT_ORGANIZATION_ID ?? '', 10);

/** Fallback organization segment when the client omits `drive.organizationId`. */
export const DRIVE_DEFAULT_ORGANIZATION_ID = Number.isFinite(parsedDefaultOrg) ? parsedDefaultOrg : 1;

/** Root directory for stored drive files; on Linux use an absolute path (e.g. `/var/maq/storage`). */
export function resolveDriveStorageRoot(): string {
  const raw = process.env.DRIVE_STORAGE_ROOT?.trim();
  return raw && raw.length > 0 ? raw : join(process.cwd(), 'storage');
}
