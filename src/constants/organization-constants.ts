/** Shared org ids and login_method values — imported by CLI scripts (`npm run register:*`) via Node strip-types. */

/** Fixed internal tenant: MAQ superadmin bootstrap only — not a client institution. */
export const PRIVATE_ORGANIZATION_ID = 1;

/** Display name for {@link PRIVATE_ORGANIZATION_ID} seeded by migration 016. */
export const PRIVATE_ORGANIZATION_NAME = 'MyAcademyQuest Internal';

/** Organization uses institutional SAML / PIONIER picker (`auth.organizations.login_method`). */
export const ORGANIZATION_LOGIN_METHOD_SAML = 'saml';

/** Organization uses email magic-link login (`auth.organizations.login_method`). */
export const ORGANIZATION_LOGIN_METHOD_EMAIL = 'email';

/** Internal MAQ-only organization; excluded from public login pickers. */
export const ORGANIZATION_LOGIN_METHOD_INTERNAL = 'internal';

/** Inclusive lower bound of ids reserved for dev/test SAML tenants (e.g. localhost IdP). */
export const RESERVED_ORGANIZATION_ID_MIN = 2;

/** Inclusive upper bound of ids reserved for dev/test tenants. */
export const RESERVED_ORGANIZATION_ID_MAX = 10;

/** First organization id assigned to production university tenants via `register:org --production`. */
export const FIRST_TENANT_ORGANIZATION_ID = 11;

/** PostgreSQL sequence backing `auth.organizations.id`. */
export const ORGANIZATIONS_ID_SEQUENCE = 'auth.organizacje_id_seq';

/** Maximum ids accepted by `POST /api/admin/organizations/bulk`. */
export const ORGANIZATION_BULK_MAX_IDS = 50;

/**
 * Hostname, `localhost`, `127.0.0.1`, or `192.168.0.0`–`192.168.0.255`.
 * No scheme and no path.
 */
export const ORGANIZATION_DOMAIN_PATTERN = /^(?:(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}|localhost|127\.0\.0\.1|192\.168\.0\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))$/i;

/** Returned when `domain` fails {@link ORGANIZATION_DOMAIN_PATTERN}. */
export const ORGANIZATION_DOMAIN_INVALID_MESSAGE =
  'domain must be a hostname, localhost, 127.0.0.1, or 192.168.0.0-255';

/** ISO 3166-1 alpha-2 country code. Length matches `AUTH_ORGANIZATION_ADDRESS_COUNTRY_MAX_LENGTH`. */
export const ORGANIZATION_COUNTRY_CODE_PATTERN = /^[A-Za-z]{2}$/;
