import type { Request } from 'express';

import {
  buildClearSamlCookieOptions,
  buildPendingOrgCookieOptions,
  buildSamlSessionCookieOptions,
  isHttpsRequest,
  isLoopbackRequest,
  resolvePendingOrgCookieSameSite,
} from './saml-cookie-options.util';

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    secure: false,
    headers: {},
    ...overrides,
  } as Request;
}

describe('isHttpsRequest', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns true in production', () => {
    process.env.NODE_ENV = 'production';
    expect(isHttpsRequest(mockRequest())).toBe(true);
  });

  it('returns true when req.secure is set', () => {
    process.env.NODE_ENV = 'development';
    expect(isHttpsRequest(mockRequest({ secure: true }))).toBe(true);
  });

  it('returns true when X-Forwarded-Proto is https', () => {
    process.env.NODE_ENV = 'development';
    expect(
      isHttpsRequest(
        mockRequest({
          headers: { 'x-forwarded-proto': 'https,http' },
        }),
      ),
    ).toBe(true);
  });

  it('returns false for plain local HTTP', () => {
    process.env.NODE_ENV = 'development';
    expect(isHttpsRequest(mockRequest())).toBe(false);
  });
});

describe('buildPendingOrgCookieOptions', () => {
  it('uses SameSite=None on HTTPS requests', () => {
    const options = buildPendingOrgCookieOptions(mockRequest({ secure: true }), 60_000);
    expect(options.sameSite).toBe('none');
    expect(options.secure).toBe(true);
  });

  it('uses SameSite=None on local HTTP loopback (cross-port IdP → ACS)', () => {
    process.env.NODE_ENV = 'development';
    const options = buildPendingOrgCookieOptions(
      mockRequest({ headers: { host: '127.0.0.1:8080' } }),
      60_000,
    );
    expect(options.sameSite).toBe('none');
    expect(options.secure).toBe(false);
  });

  it('uses SameSite=Lax on non-loopback HTTP', () => {
    process.env.NODE_ENV = 'development';
    const options = buildPendingOrgCookieOptions(
      mockRequest({ headers: { host: '192.168.1.10:8080' } }),
      60_000,
    );
    expect(options.sameSite).toBe('lax');
    expect(options.secure).toBe(false);
  });
});

describe('isLoopbackRequest', () => {
  it('detects 127.0.0.1', () => {
    expect(isLoopbackRequest(mockRequest({ headers: { host: '127.0.0.1:3000' } }))).toBe(true);
  });
});

describe('resolvePendingOrgCookieSameSite', () => {
  it('returns none for loopback dev', () => {
    expect(
      resolvePendingOrgCookieSameSite(mockRequest({ headers: { host: '127.0.0.1:8080' } })),
    ).toBe('none');
  });
});

describe('buildSamlSessionCookieOptions', () => {
  it('keeps SameSite=Lax even on HTTPS', () => {
    const options = buildSamlSessionCookieOptions(mockRequest({ secure: true }), 60_000);
    expect(options.sameSite).toBe('lax');
    expect(options.secure).toBe(true);
  });
});

describe('buildClearSamlCookieOptions', () => {
  it('matches pending org SameSite=None on HTTPS', () => {
    const options = buildClearSamlCookieOptions(mockRequest({ secure: true }), 'none');
    expect(options).toEqual({ path: '/', secure: true, sameSite: 'none' });
  });
});
