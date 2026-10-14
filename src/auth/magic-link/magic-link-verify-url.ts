import { MAGIC_LINK_VERIFY_PATH } from '../../constants/magic-link-constants';

/**
 * Public origin of the SPA that requested the magic link (no trailing slash).
 * Prefers Origin when it matches this API's public Host, so WMI and the
 * testing playground can share one image without pinning one verify URL.
 */
export function resolveMagicLinkVerifyBaseUrl(
  request: { headers: Record<string, string | string[] | undefined> },
  envVerifyBaseUrl: string,
): string {
  const requestOrigin = readRequestPublicOrigin(request);
  if (requestOrigin !== null) {
    return `${requestOrigin}${MAGIC_LINK_VERIFY_PATH}`;
  }
  return envVerifyBaseUrl.trim().replace(/\/+$/, '');
}

export function readRequestPublicOrigin(
  request: { headers: Record<string, string | string[] | undefined> },
): string | null {
  const apiHost = firstHeader(request.headers['x-forwarded-host'] ?? request.headers.host);
  const originHeader = firstHeader(request.headers.origin);
  if (originHeader !== null) {
    const origin = parseHttpOrigin(originHeader);
    if (origin === null) {
      return null;
    }
    if (apiHost === null || hostsMatch(origin.host, apiHost)) {
      return origin.origin;
    }
  }
  if (apiHost === null) {
    return null;
  }
  const proto = firstHeader(request.headers['x-forwarded-proto']) ?? 'https';
  if (proto !== 'http' && proto !== 'https') {
    return null;
  }
  return `${proto}://${apiHost.split(',')[0].trim()}`;
}

function firstHeader(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  if (Array.isArray(value) && value.length > 0 && value[0].trim() !== '') {
    return value[0].trim();
  }
  return null;
}

function parseHttpOrigin(raw: string): { origin: string; host: string } | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return { origin: url.origin, host: url.host };
  } catch {
    return null;
  }
}

function hostsMatch(originHost: string, apiHostHeader: string): boolean {
  const apiHost = apiHostHeader.split(',')[0].trim().toLowerCase();
  return originHost.toLowerCase() === apiHost;
}
