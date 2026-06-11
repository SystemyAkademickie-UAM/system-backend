/**
 * HTTP-only cookie holding the JWT issued after SAML ACS (same name as {@link SamlController}).
 */
export const SAML_SESSION_COOKIE_NAME = 'saml_session';

/** HTTP-only cookie storing selected organization id between SAML login start and ACS. */
export const SAML_PENDING_ORG_COOKIE_NAME = 'maq_saml_pending_org';

/** RelayState prefix for organization id (survives cross-site IdP POST to ACS). */
export const SAML_RELAY_STATE_ORG_PREFIX = 'org:';

/** Pending organization cookie lifetime (15 minutes). */
export const SAML_PENDING_ORG_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;

/** Minimum `SAML_JWT_SECRET` length enforced in production (session JWT signing key). */
export const SAML_JWT_SECRET_MIN_LENGTH = 32;
