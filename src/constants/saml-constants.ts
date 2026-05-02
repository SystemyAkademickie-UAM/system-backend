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

/** SAML 2.0 metadata XML namespace (used with explicit `md:` prefix for IdP tooling compatibility). */
export const SAML_METADATA_XML_NS = 'urn:oasis:names:tc:SAML:2.0:metadata';

/** SAML 2.0 metadata: HTTP endpoints use these binding URIs. */
export const SAML_BINDING_HTTP_REDIRECT = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect';
export const SAML_BINDING_HTTP_POST = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST';
export const SAML_BINDING_HTTP_ARTIFACT = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Artifact';
export const SAML_PROTOCOL_ENUMERATION = 'urn:oasis:names:tc:SAML:2.0:protocol';

/**
 * Default UAM SimpleSAMLphp **SingleLogoutService** (HTTP-Redirect/POST in IdP metadata).
 * Override with `SAML_IDP_LOGOUT_URL` when using another IdP.
 */
export const SAML_DEFAULT_UAM_IDP_SINGLE_LOGOUT_SERVICE_URL =
  'https://sso.amu.edu.pl/simplesaml/saml2/idp/SingleLogoutService.php';

/** When NameIDFormat is absent on the SAML profile, LogoutRequest uses this Format attribute. */
export const SAML_LOGOUT_FALLBACK_NAME_ID_FORMAT =
  'urn:oasis:names:tc:SAML:2.0:nameid-format:transient';

/** HTTP-only cookie lifetime for the post-SAML session JWT (milliseconds). */
export const SAML_SESSION_COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;

/**
 * When truthy (`true`, `1`, `yes`), `GET /metadata` adds HTTP-Artifact ACS (`index="1"`).
 * Default export omits it until SOAP artifact resolution is implemented — see docs/api.md.
 */
export const SAML_METADATA_INCLUDE_ARTIFACT_ACS_ENV_KEY = 'SAML_METADATA_INCLUDE_ARTIFACT_ACS';
