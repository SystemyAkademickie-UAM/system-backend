/** Entropy byte length before base64url encoding (256-bit secret space). */
export const OPAQUE_API_TOKEN_RANDOM_BYTE_LENGTH = 32;

/** Node `crypto.createHmac` algorithm name for deterministic storage fingerprints. */
export const OPAQUE_API_TOKEN_HMAC_ALGORITHM = 'sha256';

/** HMAC-SHA256 digest length as lowercase hexadecimal (32 bytes → 64 chars). */
export const OPAQUE_API_TOKEN_STORAGE_HMAC_HEX_LENGTH = 64;

/** Minimum `API_TOKEN_HMAC_SECRET` length in production environments. */
export const API_TOKEN_HMAC_SECRET_MIN_LENGTH = 32;

/**
 * Sliding idle window: a token expires this many seconds after the last authenticated request.
 * Refreshed on activity (see `AuthTokenSessionService`). Default: 24 minutes.
 * Override with env `API_TOKEN_IDLE_TIMEOUT_SECONDS`.
 */
export const API_TOKEN_IDLE_TIMEOUT_DEFAULT_SECONDS = 24 * 60;

/**
 * Absolute maximum lifetime measured from `created_at`; idle refresh can never extend past this.
 * Default: 8 hours. Override with env `API_TOKEN_ABSOLUTE_MAX_SECONDS`.
 */
export const API_TOKEN_ABSOLUTE_MAX_DEFAULT_SECONDS = 8 * 60 * 60;

/**
 * Minimum gap between idle-expiry refresh writes, to avoid a DB UPDATE on every single request.
 * The sliding window is only persisted when it would advance `expired_at` by at least this much.
 */
export const API_TOKEN_REFRESH_THRESHOLD_SECONDS = 30;

/** Env key for the sliding idle timeout (seconds). */
export const API_TOKEN_IDLE_TIMEOUT_ENV_KEY = 'API_TOKEN_IDLE_TIMEOUT_SECONDS';

/** Env key for the absolute maximum session lifetime (seconds). */
export const API_TOKEN_ABSOLUTE_MAX_ENV_KEY = 'API_TOKEN_ABSOLUTE_MAX_SECONDS';

/**
 * HTTP-only cookie holding the opaque auth token after `/login`.
 * Sent automatically by browsers; protected endpoints read from this OR body `auth` field.
 */
export const MAQ_AUTH_COOKIE_NAME = 'maq_auth';

/**
 * HTTP-only cookie holding the user's selected active role (must be one the user actually holds).
 * Read on `/login/me` to resolve `activeRole`; cleared on logout.
 */
export const MAQ_ACTIVE_ROLE_COOKIE_NAME = 'maq_active_role';
