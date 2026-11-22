/**
 * Storage quota constants for organization tenants.
 *
 * Each organization receives an allocated quota (default: 100 MiB),
 * allowing dozens of group banners (max 4 MiB each) to fit within
 * the overall host machine constraint (total server pool: ~5 GiB).
 */

/** Default organization storage quota in megabytes (100 MiB). */
export const ORGANIZATION_DEFAULT_STORAGE_QUOTA_MB = 100;

/** Default organization storage quota in bytes (100 MiB). */
export const ORGANIZATION_DEFAULT_STORAGE_QUOTA_BYTES = 100 * 1024 * 1024;

/** Total host server disk pool across all organizations in megabytes (5120 MiB / 5 GiB). */
export const SERVER_TOTAL_STORAGE_POOL_MB = 5120;

/** Total host server disk pool across all organizations (5 GiB). */
export const SERVER_TOTAL_STORAGE_POOL_BYTES = 5 * 1024 * 1024 * 1024;

/** Minimum allowed quota per organization in MB (1 MB). */
export const ORGANIZATION_STORAGE_QUOTA_MB_MIN = 1;

/** Maximum allowed quota per organization in MB (5120 MB / 5 GB). */
export const ORGANIZATION_STORAGE_QUOTA_MB_MAX = 5120;

/** Estimated average banner file size in bytes (1.5 MiB). */
export const ESTIMATED_BANNER_AVERAGE_BYTES = 1.5 * 1024 * 1024;

/**
 * Resolves the configured storage quota per organization in bytes.
 * Reads ORGANIZATION_STORAGE_QUOTA_BYTES or ORGANIZATION_STORAGE_QUOTA_MB,
 * falling back to ORGANIZATION_DEFAULT_STORAGE_QUOTA_BYTES (100 MiB).
 */
export function resolveOrganizationStorageQuotaBytes(): number {
  const bytesEnv = process.env.ORGANIZATION_STORAGE_QUOTA_BYTES?.trim();
  if (bytesEnv) {
    const parsed = Number.parseInt(bytesEnv, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const mbEnv = process.env.ORGANIZATION_STORAGE_QUOTA_MB?.trim();
  if (mbEnv) {
    const parsed = Number.parseInt(mbEnv, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed * 1024 * 1024;
    }
  }

  return ORGANIZATION_DEFAULT_STORAGE_QUOTA_BYTES;
}

/**
 * Resolves the server total storage pool across all organizations in bytes (default: 5 GiB).
 */
export function resolveServerStoragePoolBytes(): number {
  const bytesEnv = process.env.SERVER_STORAGE_POOL_BYTES?.trim();
  if (bytesEnv) {
    const parsed = Number.parseInt(bytesEnv, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return SERVER_TOTAL_STORAGE_POOL_BYTES;
}
