import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

import {
  API_TOKEN_DEFAULT_TTL_SECONDS,
  API_TOKEN_HMAC_SECRET_MIN_LENGTH,
  OPAQUE_API_TOKEN_HMAC_ALGORITHM,
} from '../../constants/api-token-constants';

const LOCAL_DEV_hmac_SECRET_FALLBACK =
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
   * @returns hexadecimal digest stored in `auth_tokens.token_hmac` (never persist the plaintext).
   */
  digestPlainTokenHex(plaintextToken: string): string {
    const secretUtf8 = this.resolveSecretUtf8();
    return createHmac(OPAQUE_API_TOKEN_HMAC_ALGORITHM, secretUtf8)
      .update(plaintextToken, 'utf8')
      .digest('hex');
  }

  /**
   * Absolute expiry instant for newly issued tokens.
   */
  resolveExpiresAfterSeconds(): number {
    const raw = this.configService.get<string>('API_TOKEN_TTL_SECONDS', '').trim();
    if (raw === '') {
      return API_TOKEN_DEFAULT_TTL_SECONDS;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return API_TOKEN_DEFAULT_TTL_SECONDS;
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
    return LOCAL_DEV_hmac_SECRET_FALLBACK;
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
