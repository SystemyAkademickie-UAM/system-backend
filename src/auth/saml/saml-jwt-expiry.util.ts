import { SAML_SESSION_COOKIE_MAX_AGE_MS } from '../../constants/saml-constants';

/**
 * Converts a `jsonwebtoken`-style `expiresIn` string (or seconds as number string) to cookie `maxAge` ms.
 * Supported suffixes: `ms`, `s`, `m`, `h`, `d` (e.g. `8h`, `15m`). Unknown shapes fall back to the default window.
 */
export function jwtExpiresInToCookieMaxAgeMs(expiresIn: string): number {
  const trimmed = expiresIn.trim();
  const withUnit = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(trimmed);
  if (withUnit !== null) {
    const value = Number(withUnit[1]);
    const unit = withUnit[2].toLowerCase();
    if (unit === 'ms') {
      return value;
    }
    if (unit === 's') {
      return value * 1000;
    }
    if (unit === 'm') {
      return value * 60 * 1000;
    }
    if (unit === 'h') {
      return value * 60 * 60 * 1000;
    }
    if (unit === 'd') {
      return value * 24 * 60 * 60 * 1000;
    }
  }
  const asSeconds = Number(trimmed);
  if (Number.isFinite(asSeconds) && asSeconds > 0) {
    return Math.floor(asSeconds * 1000);
  }
  return SAML_SESSION_COOKIE_MAX_AGE_MS;
}
