import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

import {
  SESSION_ABSOLUTE_MAX_DEFAULT_SECONDS,
  SESSION_ABSOLUTE_MAX_ENV_KEY,
  SESSION_ABSOLUTE_MAX_LEGACY_ENV_KEY,
  SESSION_HMAC_ALGORITHM,
  SESSION_HMAC_SECRET_ENV_KEY,
  SESSION_HMAC_SECRET_LEGACY_ENV_KEY,
  SESSION_HMAC_SECRET_MIN_LENGTH,
  SESSION_IDLE_TIMEOUT_DEFAULT_SECONDS,
  SESSION_IDLE_TIMEOUT_ENV_KEY,
  SESSION_IDLE_TIMEOUT_LEGACY_ENV_KEY,
} from '../../constants/session-constants';

const LOCAL_DEV_HMAC_SECRET_FALLBACK =
  'local-dev-only-session-hmac-secret-change-me-32-char-minimum';

/**
 * Derives deterministic storage identifiers from plaintext session ids using HMAC-SHA256(secret, plaintext).
 */
@Injectable()
export class SessionHmacService implements OnModuleInit {
  private readonly logger = new Logger(SessionHmacService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.bootValidateConfiguredSecretWhereRequired();
    this.warnLegacyEnvKeys();
  }

  /**
   * @returns hexadecimal digest stored in `auth.sessions.session_hmac` (never persist the plaintext).
   */
  digestPlainSessionHex(plaintextSession: string): string {
    const secretUtf8 = this.resolveSecretUtf8();
    return createHmac(SESSION_HMAC_ALGORITHM, secretUtf8)
      .update(plaintextSession, 'utf8')
      .digest('hex');
  }

  /**
   * Sliding idle window in seconds; a session expires this long after the last request.
   */
  resolveIdleTimeoutSeconds(): number {
    return this.resolvePositiveIntEnvWithFallback(
      SESSION_IDLE_TIMEOUT_ENV_KEY,
      SESSION_IDLE_TIMEOUT_LEGACY_ENV_KEY,
      SESSION_IDLE_TIMEOUT_DEFAULT_SECONDS);
  }

  /**
   * Absolute maximum session lifetime in seconds, measured from session creation.
   */
  resolveAbsoluteMaxSeconds(): number {
    return this.resolvePositiveIntEnvWithFallback(
      SESSION_ABSOLUTE_MAX_ENV_KEY,
      SESSION_ABSOLUTE_MAX_LEGACY_ENV_KEY,
      SESSION_ABSOLUTE_MAX_DEFAULT_SECONDS);
  }

  private resolvePositiveIntEnvWithFallback(
    primaryKey: string,
    legacyKey: string,
    fallbackSeconds: number): number {
    const primary = this.configService.get<string>(primaryKey, '').trim();
    if (primary !== '') {
      const parsed = Number.parseInt(primary, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    const legacy = this.configService.get<string>(legacyKey, '').trim();
    if (legacy !== '') {
      const parsed = Number.parseInt(legacy, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return fallbackSeconds;
  }

  private resolveSecretUtf8(): string {
    const primary = this.configService.get<string>(SESSION_HMAC_SECRET_ENV_KEY, '').trim();
    if (primary.length > 0) {
      return primary;
    }
    const legacy = this.configService.get<string>(SESSION_HMAC_SECRET_LEGACY_ENV_KEY, '').trim();
    if (legacy.length > 0) {
      return legacy;
    }
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      throw new Error(`${SESSION_HMAC_SECRET_ENV_KEY} must be set in production`);
    }
    return LOCAL_DEV_HMAC_SECRET_FALLBACK;
  }

  private bootValidateConfiguredSecretWhereRequired(): void {
    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction) {
      return;
    }
    const primary = this.configService.get<string>(SESSION_HMAC_SECRET_ENV_KEY, '').trim();
    const legacy = this.configService.get<string>(SESSION_HMAC_SECRET_LEGACY_ENV_KEY, '').trim();
    const secret = primary.length > 0 ? primary : legacy;
    if (secret.length === 0) {
      throw new Error(`${SESSION_HMAC_SECRET_ENV_KEY} must be set in production`);
    }
    if (secret.length < SESSION_HMAC_SECRET_MIN_LENGTH) {
      throw new Error(
        `${SESSION_HMAC_SECRET_ENV_KEY} must be at least ${SESSION_HMAC_SECRET_MIN_LENGTH} characters`);
    }
  }

  private warnLegacyEnvKeys(): void {
    const legacySecret = this.configService.get<string>(SESSION_HMAC_SECRET_LEGACY_ENV_KEY, '').trim();
    const primarySecret = this.configService.get<string>(SESSION_HMAC_SECRET_ENV_KEY, '').trim();
    if (legacySecret.length > 0 && primarySecret.length === 0) {
      this.logger.warn(
        `Using legacy env ${SESSION_HMAC_SECRET_LEGACY_ENV_KEY}; migrate to ${SESSION_HMAC_SECRET_ENV_KEY}`);
    }
  }
}
