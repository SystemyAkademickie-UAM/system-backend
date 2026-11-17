/** Page size for the organization administrator log. */
export const ORGANIZATION_LOG_PAGE_SIZE_DEFAULT = 50;

/** Upper bound for one page of the organization administrator log. */
export const ORGANIZATION_LOG_PAGE_SIZE_MAX = 100;

/** Extra row fetched to decide whether another page exists. */
export const ORGANIZATION_LOG_PAGE_PROBE_EXTRA = 1;

/** Stored display name and file name length. */
export const ORGANIZATION_LOG_TEXT_MAX_LENGTH = 255;

/** Log rows that belong to the organization rather than one group. */
export const ORGANIZATION_LOG_CATEGORY_ORGANIZATION = 'organization';

/** Log rows that point at one group. */
export const ORGANIZATION_LOG_CATEGORY_GROUP = 'group';

export const ORGANIZATION_LOG_CATEGORIES = [
  'all',
  ORGANIZATION_LOG_CATEGORY_ORGANIZATION,
  ORGANIZATION_LOG_CATEGORY_GROUP,
] as const;

export const ORGANIZATION_LOG_KIND_ROLE_GRANTED = 'role_granted';
export const ORGANIZATION_LOG_KIND_ROLE_REVOKED = 'role_revoked';
export const ORGANIZATION_LOG_KIND_LOGIN_LINK_SENT = 'login_link_sent';
export const ORGANIZATION_LOG_KIND_SIGNED_IN = 'signed_in';
export const ORGANIZATION_LOG_KIND_GROUP_CREATED = 'group_created';
export const ORGANIZATION_LOG_KIND_REMOVED_FROM_GROUP = 'removed_from_group';
export const ORGANIZATION_LOG_KIND_BADGE_REVOKED = 'badge_revoked';
export const ORGANIZATION_LOG_KIND_ACTIVITY_COMPLETION_REMOVED = 'activity_completion_removed';
export const ORGANIZATION_LOG_KIND_FILE_STORED = 'file_stored';
export const ORGANIZATION_LOG_KIND_FILE_REMOVED = 'file_removed';

export const ORGANIZATION_LOG_FILE_KIND_IMAGE = 'image';
export const ORGANIZATION_LOG_FILE_KIND_FILE = 'file';

export const ORGANIZATION_LOG_SOURCE_ARCHIVE = 'archive';
export const ORGANIZATION_LOG_SOURCE_INBOX = 'inbox';

/** Inbox event types copied once into the organization log. */
export const ORGANIZATION_LOG_INBOX_KIND_BY_TYPE: Readonly<Record<string, string>> = {
  STUDENT_JOINED: 'student_joined',
  SHOP_PURCHASE: 'shop_purchase',
  ITEM_USED: 'item_used',
  ACTIVITY_COMPLETED: 'activity_completed',
  RANK_UP: 'rank_up',
  BADGE_EARNED: 'badge_earned',
  STAGE_ADDED: 'stage_added',
  BADGE_ADDED: 'badge_added',
  RANK_ADDED: 'rank_added',
  SHOP_ITEM_ADDED: 'shop_item_added',
  LIVES_SYSTEM_CHANGED: 'lives_system_changed',
  SHOP_STATUS_CHANGED: 'shop_status_changed',
  POST_ADDED: 'post_added',
  CURRENCY_ADDED: 'currency_added',
  LIVES_CHANGED: 'lives_changed',
};
