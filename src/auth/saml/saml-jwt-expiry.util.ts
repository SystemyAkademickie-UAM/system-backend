const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
/** When `expiresIn` is missing or invalid, match {@link SamlConfigService} default (`8h`). */
const DEFAULT_SESSION_EXPIRES_HOURS = 8;

const MS_PER_MINUTE = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const MS_PER_HOUR = MINUTES_PER_HOUR * MS_PER_MINUTE;
const MS_PER_DAY = HOURS_PER_DAY * MS_PER_HOUR;

const JWT_EXPIRES_UNIT_TO_MS: Readonly<Record<string, number>> = {
  s: MILLISECONDS_PER_SECOND,
  m: MS_PER_MINUTE,
  h: MS_PER_HOUR,
  d: MS_PER_DAY,
};

/**
 * Maps a `jsonwebtoken`-style `expiresIn` string (e.g. `8h`, `900`, `15m`) to cookie `maxAge` milliseconds.
 */
export function jwtExpiresInToCookieMaxAgeMs(expiresIn: string): number {
  const trimmed = expiresIn.trim();
  if (trimmed === '') {
    return MINUTES_PER_HOUR * MS_PER_MINUTE * DEFAULT_SESSION_EXPIRES_HOURS;
  }
  const numericOnly = /^\d+$/.exec(trimmed);
  if (numericOnly !== null) {
    const seconds = Number.parseInt(trimmed, 10);
    return Number.isFinite(seconds) ? seconds * MILLISECONDS_PER_SECOND : MINUTES_PER_HOUR * MS_PER_MINUTE * DEFAULT_SESSION_EXPIRES_HOURS;
  }
  const withUnit = /^(\d+)\s*([smhd])$/i.exec(trimmed);
  if (withUnit !== null) {
    const amount = Number.parseInt(withUnit[1], 10);
    const unitKey = withUnit[2].toLowerCase();
    const unitMs = JWT_EXPIRES_UNIT_TO_MS[unitKey];
    if (Number.isFinite(amount) && unitMs !== undefined) {
      return amount * unitMs;
    }
  }
  return MINUTES_PER_HOUR * MS_PER_MINUTE * DEFAULT_SESSION_EXPIRES_HOURS;
}
