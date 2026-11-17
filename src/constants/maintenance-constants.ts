/**
 * Fixed primary key for the singleton maintenance mode row in `services.maintenance_mode`.
 */
export const MAINTENANCE_MODE_SINGLETON_ID = 1;

/**
 * Maximum character length for the notice message on the technical break screen.
 */
export const MAINTENANCE_MESSAGE_MAX_LENGTH = 1000;

/**
 * Allowed path prefixes during an active maintenance break.
 * Includes auth/login/session flows and avatar catalog needed during onboarding
 * so all users can sign in (and see the technical break screen), while platform APIs stay blocked.
 */
export const MAINTENANCE_BYPASS_PATH_PREFIXES = [
  '/api/system',
  '/api/auth',
  '/api/login',
  '/api/logout',
  '/api/profile/avatars',
  '/api/docs',
  '/api/docs-json',
  '/api/docs-yaml',
  '/api/counter/health',
] as const;

export const MAINTENANCE_API_PREFIX = '/api';
