import { ConfigService } from '@nestjs/config';

import {
  API_TOKEN_ABSOLUTE_MAX_DEFAULT_SECONDS,
  API_TOKEN_IDLE_TIMEOUT_DEFAULT_SECONDS,
} from '../../constants/api-token-constants';
import { AuthTokenHmacService } from './auth-token-hmac.service';

/** Minimal ConfigService stub backed by a plain record. */
function buildConfigService(values: Record<string, string>): ConfigService {
  return {
    get: (key: string, defaultValue?: string) => values[key] ?? defaultValue ?? '',
  } as unknown as ConfigService;
}

describe('AuthTokenHmacService', () => {
  describe('resolveIdleTimeoutSeconds', () => {
    it('returns the default when the env var is unset', () => {
      const service = new AuthTokenHmacService(buildConfigService({}));
      expect(service.resolveIdleTimeoutSeconds()).toBe(API_TOKEN_IDLE_TIMEOUT_DEFAULT_SECONDS);
    });

    it('returns the configured positive override', () => {
      const service = new AuthTokenHmacService(
        buildConfigService({ API_TOKEN_IDLE_TIMEOUT_SECONDS: '600' }),
      );
      expect(service.resolveIdleTimeoutSeconds()).toBe(600);
    });

    it('falls back to the default for non-positive or invalid values', () => {
      const service = new AuthTokenHmacService(
        buildConfigService({ API_TOKEN_IDLE_TIMEOUT_SECONDS: '0' }),
      );
      expect(service.resolveIdleTimeoutSeconds()).toBe(API_TOKEN_IDLE_TIMEOUT_DEFAULT_SECONDS);
    });
  });

  describe('resolveAbsoluteMaxSeconds', () => {
    it('returns the default when the env var is unset', () => {
      const service = new AuthTokenHmacService(buildConfigService({}));
      expect(service.resolveAbsoluteMaxSeconds()).toBe(API_TOKEN_ABSOLUTE_MAX_DEFAULT_SECONDS);
    });

    it('returns the configured positive override', () => {
      const service = new AuthTokenHmacService(
        buildConfigService({ API_TOKEN_ABSOLUTE_MAX_SECONDS: '3600' }),
      );
      expect(service.resolveAbsoluteMaxSeconds()).toBe(3600);
    });
  });

  describe('digestPlainTokenHex', () => {
    it('is deterministic for the same input and secret', () => {
      const service = new AuthTokenHmacService(
        buildConfigService({ API_TOKEN_HMAC_SECRET: 'x'.repeat(40) }),
      );
      const first = service.digestPlainTokenHex('token-value');
      const second = service.digestPlainTokenHex('token-value');
      expect(first).toBe(second);
      expect(first).toHaveLength(64);
    });
  });
});
