import { API_TOKEN_HMAC_SECRET_MIN_LENGTH } from './constants/api-token-constants';
import {
  assertDatabaseEnv,
  assertRequiredEnv,
  DATABASE_ENV_KEYS,
  isNonEmptyString,
  REQUIRED_STRING_ENV_KEYS,
} from './validate-env';

/** Non-config placeholder: tests presence checks only, not real env values. */
const PRESENT = 'present';

function setMinimalValidRequiredEnv(overrides: Record<string, string | undefined> = {}): void {
  for (const key of REQUIRED_STRING_ENV_KEYS) {
    process.env[key] = PRESENT;
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('validate-env', () => {
  const originalEnv = { ...process.env };
  const touchedKeys = new Set<string>();

  beforeEach(() => {
    touchedKeys.clear();
    for (const key of [...REQUIRED_STRING_ENV_KEYS, 'API_TOKEN_HMAC_SECRET']) {
      touchedKeys.add(key);
    }
  });

  afterEach(() => {
    for (const key of touchedKeys) {
      const originalValue = originalEnv[key];
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    }
  });

  describe('isNonEmptyString', () => {
    it('returns false for empty or whitespace-only values', () => {
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
    });

    it('returns true for non-empty trimmed strings', () => {
      expect(isNonEmptyString(PRESENT)).toBe(true);
      expect(isNonEmptyString(`  ${PRESENT}  `)).toBe(true);
    });
  });

  describe('assertDatabaseEnv', () => {
    it('passes when all DATABASE_* vars are set', () => {
      for (const key of DATABASE_ENV_KEYS) {
        process.env[key] = PRESENT;
      }
      expect(() => assertDatabaseEnv()).not.toThrow();
    });

    it('throws listing missing DATABASE_* keys', () => {
      for (const key of DATABASE_ENV_KEYS) {
        process.env[key] = PRESENT;
      }
      process.env.DATABASE_HOST = '';
      delete process.env.DATABASE_PASSWORD;
      expect(() => assertDatabaseEnv()).toThrow(/DATABASE_HOST/);
      expect(() => assertDatabaseEnv()).toThrow(/DATABASE_PASSWORD/);
    });
  });

  describe('assertRequiredEnv', () => {
    it('passes when all required keys are present', () => {
      setMinimalValidRequiredEnv();
      expect(() => assertRequiredEnv()).not.toThrow();
    });

    it('throws when a required SAML string is missing', () => {
      setMinimalValidRequiredEnv({ SAML_JWT_SECRET: '  ' });
      expect(() => assertRequiredEnv()).toThrow(/SAML_JWT_SECRET/);
    });

    it('throws when a SAML cert path is missing', () => {
      setMinimalValidRequiredEnv({ SAML_SP_CERT_PATH: undefined });
      expect(() => assertRequiredEnv()).toThrow(/SAML_SP_CERT_PATH/);
    });

    it('requires API_TOKEN_HMAC_SECRET in production', () => {
      setMinimalValidRequiredEnv({ NODE_ENV: 'production', API_TOKEN_HMAC_SECRET: undefined });
      expect(() => assertRequiredEnv()).toThrow(/API_TOKEN_HMAC_SECRET/);
    });

    it('requires minimum API_TOKEN_HMAC_SECRET length in production', () => {
      setMinimalValidRequiredEnv({
        NODE_ENV: 'production',
        API_TOKEN_HMAC_SECRET: 'short',
      });
      expect(() => assertRequiredEnv()).toThrow(
        new RegExp(`min ${API_TOKEN_HMAC_SECRET_MIN_LENGTH} characters`),
      );
    });
  });
});
