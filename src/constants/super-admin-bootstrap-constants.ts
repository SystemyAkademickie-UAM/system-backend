/** Email matched against `auth.users.email` when bootstrapping the first super admin. */
export const SUPERADMIN_BOOTSTRAP_EMAIL_ENV_KEY = 'SUPERADMIN_BOOTSTRAP_EMAIL';

/** Optional `auth.organizations.id` for the bootstrap super account (defaults to private org 1). */
export const SUPERADMIN_BOOTSTRAP_ORGANIZATION_ID_ENV_KEY = 'SUPERADMIN_BOOTSTRAP_ORGANIZATION_ID';

export { PRIVATE_ORGANIZATION_ID as SUPERADMIN_BOOTSTRAP_DEFAULT_ORGANIZATION_ID } from './organization-constants';
