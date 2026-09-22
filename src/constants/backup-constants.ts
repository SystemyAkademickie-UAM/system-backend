/** Env key for AES-256-GCM backup wrapping. */
export const BACKUP_ENCRYPTION_KEY_ENV = 'BACKUP_ENCRYPTION_KEY';

/** Minimum character length of {@link BACKUP_ENCRYPTION_KEY_ENV}. */
export const BACKUP_ENCRYPTION_KEY_MIN_LENGTH = 32;

/** AES-GCM IV length in bytes. */
export const BACKUP_AES_IV_LENGTH = 16;

/** AES-GCM auth tag length in bytes. */
export const BACKUP_AES_AUTH_TAG_LENGTH = 16;

export const BACKUP_AES_ALGORITHM = 'aes-256-gcm';

export const BACKUP_FILE_EXTENSION = '.enc';

export const BACKUP_CONTENT_TYPE = 'application/octet-stream';

/** gzip compression level for pg_dump output. */
export const BACKUP_GZIP_LEVEL = 9;

/** Max restore upload size (100 MiB). */
export const BACKUP_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** pg_restore exit 1 is warnings-only; treat as success. */
export const BACKUP_PG_RESTORE_WARNING_EXIT_CODE = 1;
