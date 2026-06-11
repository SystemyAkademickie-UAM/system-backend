/** Shared time window (seconds) for auth rate-limit buckets. */
export const AUTH_THROTTLE_TTL_SECONDS = 60;

/** Default fallback limit per {@link AUTH_THROTTLE_TTL_SECONDS} when a route opts into throttling. */
export const AUTH_THROTTLE_DEFAULT_LIMIT = 60;

/** Max `POST /api/login` token mints per window per client IP. */
export const LOGIN_THROTTLE_LIMIT = 10;

/** Max `POST /api/login/active-role` switches per window per client IP. */
export const ACTIVE_ROLE_THROTTLE_LIMIT = 20;

/** Max `GET /api/auth/saml/login` SSO starts per window per client IP. */
export const SAML_LOGIN_THROTTLE_LIMIT = 15;
