import { MAGIC_LINK_VERIFY_PATH } from '../../constants/magic-link-constants';
import { resolveMagicLinkVerifyBaseUrl } from './magic-link-verify-url';

describe('resolveMagicLinkVerifyBaseUrl', () => {
  const envFallback = 'https://maq.wmi.amu.edu.pl/login/magic';

  it('uses the requesting SPA origin when it matches X-Forwarded-Host', () => {
    const actualUrl = resolveMagicLinkVerifyBaseUrl(
      {
        headers: {
          origin: 'https://maq.projektstudencki.pl',
          'x-forwarded-host': 'maq.projektstudencki.pl',
          'x-forwarded-proto': 'https',
        },
      },
      envFallback,
    );
    expect(actualUrl).toBe(`https://maq.projektstudencki.pl${MAGIC_LINK_VERIFY_PATH}`);
  });

  it('uses the WMI origin when that host requested the link', () => {
    const actualUrl = resolveMagicLinkVerifyBaseUrl(
      {
        headers: {
          origin: 'https://maq.wmi.amu.edu.pl',
          'x-forwarded-host': 'maq.wmi.amu.edu.pl',
          'x-forwarded-proto': 'https',
        },
      },
      envFallback,
    );
    expect(actualUrl).toBe(`https://maq.wmi.amu.edu.pl${MAGIC_LINK_VERIFY_PATH}`);
  });

  it('falls back to env when Origin host does not match the API host', () => {
    const actualUrl = resolveMagicLinkVerifyBaseUrl(
      {
        headers: {
          origin: 'https://evil.example',
          host: 'maq.wmi.amu.edu.pl',
        },
      },
      envFallback,
    );
    expect(actualUrl).toBe(envFallback);
  });

  it('falls back to env when no request host is present', () => {
    const actualUrl = resolveMagicLinkVerifyBaseUrl({ headers: {} }, envFallback);
    expect(actualUrl).toBe(envFallback);
  });
});
