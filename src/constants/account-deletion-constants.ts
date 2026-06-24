import {
  ADMINISTRATOR_ROLE_NAME,
  SUPER_ROLE_NAME,
} from './role-name-constants';

/** Target user roles that organization administrators are never allowed to delete. */
export const ACCOUNT_DELETION_ORG_ADMIN_FORBIDDEN_USER_ROLES = [
  ADMINISTRATOR_ROLE_NAME,
  SUPER_ROLE_NAME,
] as const;

/** Account row role that even super administrators cannot delete. */
export const ACCOUNT_DELETION_SUPER_FORBIDDEN_ACCOUNT_ROLE = SUPER_ROLE_NAME;
