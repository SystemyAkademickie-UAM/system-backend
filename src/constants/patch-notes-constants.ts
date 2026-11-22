import { join } from 'node:path';

import { resolveDriveStorageRoot } from './drive-service-constants';

/** Environment variable overriding the storage directory for patch note PDF files. */
export const PATCH_NOTES_STORAGE_DIR_ENV = 'PATCH_NOTES_STORAGE_DIR';

/** Subdirectory under the drive storage root used when PATCH_NOTES_STORAGE_DIR is unset. */
export const PATCH_NOTES_STORAGE_SUBDIR = 'patch-notes';

/** Default maximum upload size for a patch note PDF file (20 MiB). */
export const PATCH_NOTES_MAX_FILE_BYTES_DEFAULT = 20 * 1024 * 1024;

const parsedMaxBytes = Number.parseInt(process.env.PATCH_NOTES_MAX_FILE_BYTES ?? '', 10);

/** Maximum allowed size in bytes for an uploaded patch note PDF. */
export const PATCH_NOTES_MAX_FILE_BYTES =
  Number.isFinite(parsedMaxBytes) && parsedMaxBytes > 0
    ? parsedMaxBytes
    : PATCH_NOTES_MAX_FILE_BYTES_DEFAULT;

/** Expected MIME type for patch note documents. */
export const PATCH_NOTES_CONTENT_TYPE = 'application/pdf';

/** Required file extension for patch note documents. */
export const PATCH_NOTES_FILE_EXTENSION = '.pdf';

/** ASCII magic header prefix present at the beginning of every valid PDF file. */
export const PDF_MAGIC_HEADER = '%PDF-';

/** Maximum length for patch note title. */
export const PATCH_NOTES_TITLE_MAX_LENGTH = 200;

/** Maximum length for optional patch note version label. */
export const PATCH_NOTES_VERSION_MAX_LENGTH = 64;

/** Maximum length for original uploaded filename. */
export const PATCH_NOTES_FILENAME_MAX_LENGTH = 255;

/** Maximum length for generated storage key on disk. */
export const PATCH_NOTES_STORAGE_KEY_MAX_LENGTH = 128;

/** Default page size when listing patch notes. */
export const PATCH_NOTES_LIST_DEFAULT_TAKE = 50;

/** Maximum page size when listing patch notes. */
export const PATCH_NOTES_LIST_MAX_TAKE = 100;

/** Cache-Control max-age (in seconds) when serving patch note PDF binaries. */
export const PATCH_NOTES_CACHE_MAX_AGE_SECONDS = 300;

/**
 * Resolves the directory on disk where patch note PDF binaries are stored.
 */
export function resolvePatchNotesStorageDir(): string {
  const customDir = process.env[PATCH_NOTES_STORAGE_DIR_ENV]?.trim();
  if (customDir && customDir.length > 0) {
    return customDir;
  }
  return join(resolveDriveStorageRoot(), PATCH_NOTES_STORAGE_SUBDIR);
}

