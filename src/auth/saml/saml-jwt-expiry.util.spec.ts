import { SAML_SESSION_COOKIE_MAX_AGE_MS } from '../../constants/saml-constants';

import { jwtExpiresInToCookieMaxAgeMs } from './saml-jwt-expiry.util';

describe('jwtExpiresInToCookieMaxAgeMs', () => {
  it('parses hours', () => {
    expect(jwtExpiresInToCookieMaxAgeMs('8h')).toBe(8 * 60 * 60 * 1000);
  });

  it('parses numeric seconds', () => {
    expect(jwtExpiresInToCookieMaxAgeMs('3600')).toBe(3600 * 1000);
  });

  it('falls back on garbage input', () => {
    expect(jwtExpiresInToCookieMaxAgeMs('not-a-duration')).toBe(SAML_SESSION_COOKIE_MAX_AGE_MS);
  });
});
