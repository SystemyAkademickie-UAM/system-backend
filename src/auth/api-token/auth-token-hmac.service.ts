import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

import {
  API_TOKEN_ABSOLUTE_MAX_DEFAULT_SECONDS,
  API_TOKEN_ABSOLUTE_MAX_ENV_KEY,
  API_TOKEN_HMAC_SECRET_MIN_LENGTH,
  API_TOKEN_IDLE_TIMEOUT_DEFAULT_SECONDS,
  API_TOKEN_IDLE_TIMEOUT_ENV_KEY,
  OPAQUE_API_TOKEN_HMAC_ALGORITHM,
} from '../../constants/api-token-constants';

const LOCAL_DEV_HMAC_SECRET_FALLBACK =
  'local-dev-only-api-token-hmac-secret-change-me-32-char-minimum';

/**
 * Derives deterministic storage identifiers from plaintext opaque tokens using HMAC-SHA256(secret, plaintext).
 */
@Injectable()
export class AuthTokenHmacService implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.bootValidateConfiguredSecretWhereRequired();
  }

  /**
   * @returns hexadecimal digest stored in `auth.tokens.token_hmac` (never persist the plaintext).
   */
  digestPlainTokenHex(plaintextToken: string): string {
    const secretUtf8 = this.resolveSecretUtf8();
    return createHmac(OPAQUE_API_TOKEN_HMAC_ALGORITHM, secretUtf8)
      .update(plaintextToken, 'utf8')
      .digest('hex');
  }

  /**
   * Sliding idle window in seconds; a session expires this long after the last request.
   */
  resolveIdleTimeoutSeconds(): number {
    return this.resolvePositiveIntEnv(
      API_TOKEN_IDLE_TIMEOUT_ENV_KEY,
      API_TOKEN_IDLE_TIMEOUT_DEFAULT_SECONDS,
    );
  }

  /**
   * Absolute maximum session lifetime in seconds, measured from token creation.
   */
  resolveAbsoluteMaxSeconds(): number {
    return this.resolvePositiveIntEnv(
      API_TOKEN_ABSOLUTE_MAX_ENV_KEY,
      API_TOKEN_ABSOLUTE_MAX_DEFAULT_SECONDS,
    );
  }

  private resolvePositiveIntEnv(envKey: string, fallbackSeconds: number): number {
    const raw = this.configService.get<string>(envKey, '').trim();
    if (raw === '') {
      return fallbackSeconds;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallbackSeconds;
    }
    return parsed;
  }

  private resolveSecretUtf8(): string {
    const trimmed = this.configService.get<string>('API_TOKEN_HMAC_SECRET', '').trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      throw new Error('API_TOKEN_HMAC_SECRET must be set in production');
    }
    return LOCAL_DEV_HMAC_SECRET_FALLBACK;
  }

  private bootValidateConfiguredSecretWhereRequired(): void {
    const trimmed = this.configService.get<string>('API_TOKEN_HMAC_SECRET', '').trim();
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
      return;
    }
    if (trimmed.length === 0) {
      throw new Error('API_TOKEN_HMAC_SECRET must be set in production');
    }
    if (trimmed.length < API_TOKEN_HMAC_SECRET_MIN_LENGTH) {
      throw new Error(
        `API_TOKEN_HMAC_SECRET must be at least ${API_TOKEN_HMAC_SECRET_MIN_LENGTH} characters`,
      );
    }
  }
}
