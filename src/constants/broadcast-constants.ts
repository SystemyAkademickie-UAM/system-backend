/** Allowed severity levels for system-wide broadcasts. */
export const BROADCAST_LEVELS = ['info', 'warning', 'critical'] as const;
export type BroadcastLevel = (typeof BROADCAST_LEVELS)[number];

/** Allowed audience roles for broadcast targeting. */
export const BROADCAST_TARGET_ROLES = [
  'all',
  'student',
  'lecturer',
  'administrator',
] as const;
export type BroadcastTargetRole = (typeof BROADCAST_TARGET_ROLES)[number];

export const BROADCAST_DEFAULT_LEVEL: BroadcastLevel = 'info';
export const BROADCAST_TARGET_ALL: BroadcastTargetRole = 'all';

/** Validation limits */
export const BROADCAST_TITLE_MAX_LENGTH = 200;
export const BROADCAST_CONTENT_MAX_LENGTH = 4000;

/** Default and max pagination sizes for listing broadcasts */
export const BROADCAST_LIST_DEFAULT_TAKE = 50;
export const BROADCAST_LIST_MAX_TAKE = 100;
export const BROADCAST_USER_FEED_MAX_TAKE = 50;
