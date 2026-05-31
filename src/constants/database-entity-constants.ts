/** Max length for `auth.users.email`. */
export const AUTH_USER_EMAIL_MAX_LENGTH = 255;

/** Max length for short name-like columns on `auth.users`. */
export const AUTH_USER_NAME_FIELD_MAX_LENGTH = 100;

/** Max length for `auth.users.language`. */
export const AUTH_USER_LANGUAGE_MAX_LENGTH = 10;

/** Max length for `auth.tokens.token_hmac` (hex digest storage). */
export const AUTH_TOKEN_HMAC_MAX_LENGTH = 256;

/** Max length for `auth.accounts.role`. */
export const AUTH_ACCOUNT_ROLE_MAX_LENGTH = 50;

/** Max length for `auth.organizations.name`. */
export const AUTH_ORGANIZATION_NAME_MAX_LENGTH = 255;

/** Max length for `auth.organizations.contact_email`. */
export const AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH = 255;

/** Max length for `auth.organizations.contact_phone`. */
export const AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH = 64;

/** Max length for `education.enrollment_codes.code`. */
export const EDUCATION_ENROLLMENT_CODE_MAX_LENGTH = 10;

/** Max length for `education.groups.name`. */
export const EDUCATION_GROUP_NAME_MAX_LENGTH = 255;

/** Max length for short varchar columns on `education.groups` (refs, currency). */
export const EDUCATION_GROUP_VARCHAR_MAX_LENGTH = 255;

/** Max length for `gamification.badges.name` / `gamification.ranks.name`. */
export const GAMIFICATION_BADGE_NAME_MAX_LENGTH = 100;

/** Max length for `gamification.ranks.name`. */
export const GAMIFICATION_RANK_NAME_MAX_LENGTH = 100;

/** Max length for icon reference columns on gamification tables. */
export const GAMIFICATION_ICON_MAX_LENGTH = 255;

/** Max length for `services.drive.mime_type`. */
export const SERVICES_DRIVE_MIME_TYPE_MAX_LENGTH = 4;
