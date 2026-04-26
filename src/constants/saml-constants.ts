/** Passport strategy name for SAML 2.0 authentication. */
export const SAML_STRATEGY_NAME = 'saml';

/**
 * Default SAML NameIDPolicy Format for AuthnRequest.
 * Must align with the IdP metadata (local Shibboleth overlay uses transient).
 * Override with env `SAML_IDENTIFIER_FORMAT` (e.g. UAM may need a different URI).
 */
export const SAML_IDENTIFIER_FORMAT_DEFAULT = 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient';

/**
 * HTTP-only cookie storing the JWT issued after a successful SAML ACS callback.
 * Alphanumeric only — omit § and unusual symbols for UI compatibility.
 */
export const SAML_SESSION_COOKIE_NAME = 'maqSamlSession';

/** JWT lifetime after successful SAML login (Nest JWT `expiresIn` string). */
export const SAML_SESSION_JWT_EXPIRES_IN = '8h';

/** Relative route segments under the global `/api` prefix. */
export const SAML_CONTROLLER_PATH = 'auth/saml';

/**
 * Query on `GET .../auth/saml/login`: IdP must perform fresh authentication (SAML `ForceAuthn`).
 * Used after app logout so SSO does not instantly re-issue an assertion without user interaction.
 */
export const SAML_LOGIN_FORCE_AUTHN_QUERY = 'forceAuthn';

/** Accepted value for {@link SAML_LOGIN_FORCE_AUTHN_QUERY} (string match on `req.query`). */
export const SAML_LOGIN_FORCE_AUTHN_QUERY_VALUE = '1';

/** HTTP-only cookie lifetime for the post-SAML session JWT (milliseconds). */
export const SAML_SESSION_COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;
