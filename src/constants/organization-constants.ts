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
