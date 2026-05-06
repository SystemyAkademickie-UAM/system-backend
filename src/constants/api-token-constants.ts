/** Entropy byte length before base64url encoding (256-bit secret space). */
export const OPAQUE_API_TOKEN_RANDOM_BYTE_LENGTH = 32;

/** Node `crypto.createHmac` algorithm name for deterministic storage fingerprints. */
export const OPAQUE_API_TOKEN_HMAC_ALGORITHM = 'sha256';

/** HMAC-SHA256 digest length as lowercase hexadecimal (32 bytes → 64 chars). */
export const OPAQUE_API_TOKEN_STORAGE_HMAC_HEX_LENGTH = 64;

/** Minimum `API_TOKEN_HMAC_SECRET` length in production environments. */
export const API_TOKEN_HMAC_SECRET_MIN_LENGTH = 32;

/** Documented fallback lifetime when `API_TOKEN_TTL_SECONDS` is unset (~90 days). */
export const API_TOKEN_DEFAULT_TTL_SECONDS = 90 * 24 * 60 * 60;
