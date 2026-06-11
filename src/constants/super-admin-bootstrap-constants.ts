/** Email matched against `auth.users.email` when bootstrapping the first super admin. */
export const SUPERADMIN_BOOTSTRAP_EMAIL_ENV_KEY = 'SUPERADMIN_BOOTSTRAP_EMAIL';

/** Optional `auth.organizations.id` for the bootstrap super account (defaults to first active org). */
export const SUPERADMIN_BOOTSTRAP_ORGANIZATION_ID_ENV_KEY = 'SUPERADMIN_BOOTSTRAP_ORGANIZATION_ID';

/** Fallback organization id when no organizations exist yet (local dev seed). */
export const SUPERADMIN_BOOTSTRAP_DEFAULT_ORGANIZATION_ID = 1;
