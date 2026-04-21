/** Passport strategy name for SAML 2.0 authentication. */
export const SAML_STRATEGY_NAME = 'saml';

/**
 * HTTP-only cookie storing the JWT issued after a successful SAML ACS callback.
 * Alphanumeric only — omit § and unusual symbols for UI compatibility.
 */
export const SAML_SESSION_COOKIE_NAME = 'maqSamlSession';

/** JWT lifetime after successful SAML login (Nest JWT `expiresIn` string). */
export const SAML_SESSION_JWT_EXPIRES_IN = '8h';

/** Relative route segments under the global `/api` prefix. */
export const SAML_CONTROLLER_PATH = 'auth/saml';

/** HTTP-only cookie lifetime for the post-SAML session JWT (milliseconds). */
export const SAML_SESSION_COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;
