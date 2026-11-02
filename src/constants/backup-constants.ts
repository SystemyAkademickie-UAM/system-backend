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

/** Environment variable for automated backup directory. */
export const BACKUP_STORAGE_DIR_ENV = 'BACKUP_STORAGE_DIR';

/** Default directory for automated backups on the host/container. */
export const BACKUP_DEFAULT_STORAGE_DIR = './storage/backups';

/** Environment variable for automated backup retention in days. */
export const BACKUP_RETENTION_DAYS_ENV = 'BACKUP_RETENTION_DAYS';

/** Default retention period for automated backups (14 days). */
export const BACKUP_DEFAULT_RETENTION_DAYS = 14;

/** Environment variable for threshold days without manual backup before warning. */
export const BACKUP_MANUAL_WARNING_DAYS_ENV = 'BACKUP_MANUAL_WARNING_DAYS';

/** Default days threshold without manual backup before warning (7 days). */
export const BACKUP_DEFAULT_MANUAL_WARNING_DAYS = 7;

/** Prefix for automated backup files. */
export const BACKUP_AUTO_FILE_PREFIX = 'backup-auto-';

/** Metadata filename stored in the backup directory. */
export const BACKUP_METADATA_FILENAME = 'backup-metadata.json';

/** Regular expression matching automated backup filenames. */
export const BACKUP_AUTO_FILENAME_REGEX =
  /^backup-auto-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.enc$/;

