import {
  ADMINISTRATOR_ROLE_NAME,
  LECTURER_ROLE_NAME,
  STUDENT_ROLE_NAME,
} from './role-name-constants';

/** Page size for `GET .../accounts/page` when the caller omits `limit`. */
export const ORGANIZATION_ACCOUNT_PAGE_SIZE_DEFAULT = 100;

/** Maximum `limit` for one account page. */
export const ORGANIZATION_ACCOUNT_PAGE_SIZE_MAX = 100;

/** Maximum rows accepted by one account import request. */
export const ORGANIZATION_ACCOUNT_IMPORT_MAX_ROWS = 500;

/** `auth.users.student_id` for an account created by an administrator, before a real student id exists. */
export const ORGANIZATION_ACCOUNT_PLACEHOLDER_STUDENT_ID = 0;

/** Avatar used until the person finishes registration. */
export const ORGANIZATION_ACCOUNT_DEFAULT_AVATAR_ID = 1;

/** Language stored on an administrator-created user. */
export const ORGANIZATION_ACCOUNT_DEFAULT_LANGUAGE = 'PL';

/** Roles an organization administrator may assign. Super is never assigned here. */
export const ORGANIZATION_ACCOUNT_ORG_ADMIN_ROLES = [
  STUDENT_ROLE_NAME,
  LECTURER_ROLE_NAME,
] as const;

/** Roles a super administrator may assign from the account roster. */
export const ORGANIZATION_ACCOUNT_SUPER_ASSIGNABLE_ROLES = [
  STUDENT_ROLE_NAME,
  LECTURER_ROLE_NAME,
  ADMINISTRATOR_ROLE_NAME,
] as const;

/** Download name for the organization account CSV. */
export const ORGANIZATION_ACCOUNT_EXPORT_FILENAME = 'organization-accounts.csv';

/** CSV column order for the organization account export. */
export const ORGANIZATION_ACCOUNT_EXPORT_COLUMNS = [
  'accountId',
  'userId',
  'email',
  'name',
  'surname',
  'nickname',
  'role',
] as const;
