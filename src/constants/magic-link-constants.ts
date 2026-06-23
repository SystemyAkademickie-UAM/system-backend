/** Env key: magic link validity window in seconds (default 3 minutes). */
export const MAGIC_LINK_EXPIRY_SECONDS_ENV_KEY = 'MAGIC_LINK_EXPIRY_SECONDS';

/** Default magic link TTL — 3 minutes. */
export const MAGIC_LINK_EXPIRY_DEFAULT_SECONDS = 180;

/** Env key: cooldown before another request when the previous link was not consumed (default 5 minutes). */
export const MAGIC_LINK_COOLDOWN_SECONDS_ENV_KEY = 'MAGIC_LINK_COOLDOWN_SECONDS';

/** Default cooldown — 5 minutes. */
export const MAGIC_LINK_COOLDOWN_DEFAULT_SECONDS = 300;

/** Env key: SPA URL prefix for verify route (no trailing slash), e.g. `http://127.0.0.1:3000/login/magic`. */
export const MAGIC_LINK_VERIFY_BASE_URL_ENV_KEY = 'MAGIC_LINK_VERIFY_BASE_URL';

/** Env key: default organization id for `register:user` CLI provisioning (private org 1). */
export const MAGIC_LINK_ORGANIZATION_ID_ENV_KEY = 'MAGIC_LINK_ORGANIZATION_ID';

/** Env key: email subject line for magic link messages. */
export const MAGIC_LINK_EMAIL_SUBJECT_ENV_KEY = 'MAGIC_LINK_EMAIL_SUBJECT';

/** Env key: email body template; must include {@link MAGIC_LINK_URL_PLACEHOLDER}. */
export const MAGIC_LINK_EMAIL_BODY_ENV_KEY = 'MAGIC_LINK_EMAIL_BODY';

/** Placeholder replaced with the full verify URL in {@link MAGIC_LINK_EMAIL_BODY_ENV_KEY}. */
export const MAGIC_LINK_URL_PLACEHOLDER = '{{link}}';

/** Random byte length for one-time magic link tokens. */
export const MAGIC_LINK_TOKEN_RANDOM_BYTE_LENGTH = 32;

/** API error code when email is not provisioned for magic-link login. */
export const MAGIC_LINK_ACCOUNT_NOT_REGISTERED_ERROR = 'MAGIC_LINK_ACCOUNT_NOT_REGISTERED';

/** Default API message when no provisioned account exists for the email. */
export const MAGIC_LINK_ACCOUNT_NOT_REGISTERED_MESSAGE =
  'No account is registered for this email address. Contact your organization administrator.';

/** User-facing message after a link was sent to a provisioned account. */
export const MAGIC_LINK_SENT_MESSAGE = 'A login link has been sent to your email address.';
