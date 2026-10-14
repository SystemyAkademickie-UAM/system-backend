/** Default `pg` pool size when `DATABASE_POOL_MAX` is unset or invalid. */
export const DATABASE_POOL_MAX_DEFAULT = 25;

/** Default wait for a free pool connection, in milliseconds. */
export const DATABASE_CONNECTION_TIMEOUT_MS_DEFAULT = 5_000;

/** Default time an idle pool connection stays open, in milliseconds. */
export const DATABASE_IDLE_TIMEOUT_MS_DEFAULT = 30_000;
