/** IANA zone for dated log file names (matches backup schedule). */
export const PRODUCTION_LOG_TIMEZONE = 'Europe/Warsaw';

export const PRODUCTION_LOG_DIR_ENV = 'PRODUCTION_LOG_DIR';

export const PRODUCTION_LOG_TTL_SLOTS_ENV = 'PRODUCTION_LOG_TTL_SLOTS';

/** Keep this many closed 5-minute slots (3 × 5 min = 15 min for local simulation). */
export const PRODUCTION_LOG_TTL_SLOTS_DEFAULT = 3;

export const PRODUCTION_LOG_SLOT_MINUTES = 5;

export const PRODUCTION_LOG_SLOT_MS = PRODUCTION_LOG_SLOT_MINUTES * 60 * 1000;

export const PRODUCTION_LOG_LIVE_DIR_NAME = 'live';

export const PRODUCTION_LOG_ARCHIVE_DIR_NAME = 'archive';

export const PRODUCTION_LOG_FILE_EXTENSION = '.log';

export const PRODUCTION_LOG_GZIP_EXTENSION = '.log.gz';

export const PRODUCTION_LOG_ECDH_CURVE = 'prime256v1';

export const PRODUCTION_LOG_AES_ALGORITHM = 'aes-256-gcm';

export const PRODUCTION_LOG_AES_KEY_LENGTH = 32;

export const PRODUCTION_LOG_AES_IV_LENGTH = 12;

export const PRODUCTION_LOG_AES_AUTH_TAG_LENGTH = 16;

export const PRODUCTION_LOG_CLIENT_MESSAGE_MAX_CHARS = 4000;

export const PRODUCTION_LOG_LINE_MAX_CHARS = 8000;

export const PRODUCTION_LOG_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}$/;

export const PRODUCTION_LOG_TODAY_ALIAS = 'today';

/** Uncompressed SEC1 P-256 public key (0x04 || X || Y). */
export const PRODUCTION_LOG_ECDH_UNCOMPRESSED_PUBLIC_KEY_LENGTH = 65;

export const PRODUCTION_LOG_ECDH_UNCOMPRESSED_PREFIX = 0x04;
