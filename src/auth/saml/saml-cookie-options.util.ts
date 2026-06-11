import type { CookieOptions } from 'express';
import type { Request } from 'express';

/**
 * Detect HTTPS for cookie `Secure` / `SameSite=None` when the API sits behind a reverse proxy.
 */
export function isHttpsRequest(req: Request): boolean {
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  if (req.secure) {
    return true;
  }
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    const primary = forwardedProto.split(',')[0]?.trim().toLowerCase();
    if (primary === 'https') {
      return true;
    }
  }
  return false;
}

/**
 * Loopback hosts used for local dev (SPA on :3000, IdP on :5000 — different origins).
 */
export function isLoopbackRequest(req: Request): boolean {
  const hostHeader = req.headers.host?.split(':')[0]?.trim().toLowerCase() ?? '';
  return hostHeader === 'localhost' || hostHeader === '127.0.0.1' || hostHeader === '[::1]';
}

/** Whether pending-org cookie must use SameSite=None (HTTPS prod or loopback dev cross-port ACS). */
export function resolvePendingOrgCookieSameSite(req: Request): 'lax' | 'none' {
  if (isHttpsRequest(req) || isLoopbackRequest(req)) {
    return 'none';
  }
  return 'lax';
}

/**
 * Pending org cookie must survive the cross-site POST from the IdP back to ACS (`SameSite=Lax` is not sent).
 * Browsers allow `SameSite=None` without `Secure` on loopback HTTP (local IdP on another port).
 */
export function buildPendingOrgCookieOptions(req: Request, maxAgeMs: number): CookieOptions {
  const secure = isHttpsRequest(req);
  const sameSite = resolvePendingOrgCookieSameSite(req);
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: maxAgeMs,
    path: '/',
  };
}

/**
 * Auth/session cookies set on the same registrable site as the SPA.
 * Omit `maxAgeMs` (or pass <= 0) to emit a browser **session cookie** that is cleared on browser close;
 * server-side expiry (idle + absolute) is the source of truth, so the cookie itself needs no lifetime.
 */
export function buildSamlSessionCookieOptions(req: Request, maxAgeMs?: number): CookieOptions {
  const secure = isHttpsRequest(req);
  const options: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  };
  if (typeof maxAgeMs === 'number' && maxAgeMs > 0) {
    options.maxAge = maxAgeMs;
  }
  return options;
}

/** Options for `clearCookie` — must match how the cookie was originally set. */
export function buildClearSamlCookieOptions(
  req: Request,
  sameSite: 'lax' | 'none',
): Pick<CookieOptions, 'path' | 'secure' | 'sameSite'> {
  const secure = isHttpsRequest(req);
  return {
    path: '/',
    secure,
    sameSite,
  };
}
