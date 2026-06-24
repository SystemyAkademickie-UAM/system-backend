/** Entropy byte length before base64url encoding (256-bit secret space). */
export const SESSION_RANDOM_BYTE_LENGTH = 32;

/** Node `crypto.createHmac` algorithm name for deterministic storage fingerprints. */
export const SESSION_HMAC_ALGORITHM = 'sha256';

/** HMAC-SHA256 digest length as lowercase hexadecimal (32 bytes → 64 chars). */
export const SESSION_STORAGE_HMAC_HEX_LENGTH = 64;

/** Minimum `SESSION_HMAC_SECRET` length in production environments. */
export const SESSION_HMAC_SECRET_MIN_LENGTH = 32;

/**
 * Sliding idle window: a session expires this many seconds after the last authenticated request.
 * Refreshed on activity (see `SessionService`). Default: 24 minutes.
 * Override with env `SESSION_IDLE_TIMEOUT_SECONDS`.
 */
export const SESSION_IDLE_TIMEOUT_DEFAULT_SECONDS = 24 * 60;

/**
 * Absolute maximum lifetime measured from `created_at`; idle refresh can never extend past this.
 * Default: 8 hours. Override with env `SESSION_ABSOLUTE_MAX_SECONDS`.
 */
export const SESSION_ABSOLUTE_MAX_DEFAULT_SECONDS = 8 * 60 * 60;

/**
 * Minimum gap between idle-expiry refresh writes, to avoid a DB UPDATE on every single request.
 * The sliding window is only persisted when it would advance `expired_at` by at least this much.
 */
export const SESSION_REFRESH_THRESHOLD_SECONDS = 30;

/** Env key for the HMAC secret (supports legacy `API_TOKEN_HMAC_SECRET` as fallback). */
export const SESSION_HMAC_SECRET_ENV_KEY = 'SESSION_HMAC_SECRET';
export const SESSION_HMAC_SECRET_LEGACY_ENV_KEY = 'API_TOKEN_HMAC_SECRET';

/** Env key for the sliding idle timeout (seconds). */
export const SESSION_IDLE_TIMEOUT_ENV_KEY = 'SESSION_IDLE_TIMEOUT_SECONDS';
export const SESSION_IDLE_TIMEOUT_LEGACY_ENV_KEY = 'API_TOKEN_IDLE_TIMEOUT_SECONDS';

/** Env key for the absolute maximum session lifetime (seconds). */
export const SESSION_ABSOLUTE_MAX_ENV_KEY = 'SESSION_ABSOLUTE_MAX_SECONDS';
export const SESSION_ABSOLUTE_MAX_LEGACY_ENV_KEY = 'API_TOKEN_ABSOLUTE_MAX_SECONDS';

/**
 * HTTP-only cookie holding the session id after login.
 * Sent automatically by browsers; protected endpoints read from this OR body `auth` field.
 */
export const MAQ_SESSION_COOKIE_NAME = 'maq_session';

/** Legacy cookie names to clear on logout for backward compatibility. */
export const LEGACY_MAQ_AUTH_COOKIE_NAME = 'maq_auth';
export const LEGACY_MAQ_ACTIVE_ROLE_COOKIE_NAME = 'maq_active_role';
