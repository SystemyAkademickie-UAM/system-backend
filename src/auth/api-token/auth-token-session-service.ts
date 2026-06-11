import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { MoreThan, Repository } from 'typeorm';

import {
  API_TOKEN_REFRESH_THRESHOLD_SECONDS,
  MAQ_AUTH_COOKIE_NAME,
} from '../../constants/api-token-constants';
import { AuthTokenEntity } from '../../database/entities/auth-token.entity';
import { AuthTokenHmacService } from './auth-token-hmac.service';

export type AuthTokenSubject = { userId: number };

/**
 * Resolves the user bound to a row in `auth.tokens` via stored HMAC digests (no role checks).
 */
@Injectable()
export class AuthTokenSessionService {
  constructor(
    @InjectRepository(AuthTokenEntity)
    private readonly authTokenRepository: Repository<AuthTokenEntity>,
    private readonly authTokenHmacService: AuthTokenHmacService,
  ) {}

  /**
   * Extracts auth token from: 1) `maq_auth` cookie, 2) `Authorization: Bearer` header, 3) body `auth` field.
   * The token is intentionally never read from the URL query string (leaks via logs/Referer/history).
   * Returns empty string if none present.
   */
  extractAuthToken(req: Request, bodyAuth?: string): string {
    const cookieAuth = req.cookies?.[MAQ_AUTH_COOKIE_NAME];
    if (typeof cookieAuth === 'string' && cookieAuth.trim() !== '') {
      return cookieAuth.trim();
    }
    const bearer = this.extractBearerToken(req);
    if (bearer !== '') {
      return bearer;
    }
    if (typeof bodyAuth === 'string' && bodyAuth.trim() !== '') {
      return bodyAuth.trim();
    }
    return '';
  }

  /** Reads the token from an `Authorization: Bearer <token>` header, or empty string. */
  private extractBearerToken(req: Request): string {
    const header = req.headers?.authorization;
    if (typeof header !== 'string') {
      return '';
    }
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match ? match[1].trim() : '';
  }

  /**
   * Soft: token must authenticate to a non-expired row; browser header is ignored.
   */
  async resolveSubjectSoft(authTokenPlaintext: string): Promise<AuthTokenSubject | null> {
    const row = await this.findActiveAuthToken(authTokenPlaintext);
    return row !== null ? { userId: row.userId } : null;
  }

  /**
   * Soft resolution from Request: extracts token from cookie/body, then validates.
   */
  async resolveSubjectSoftFromRequest(req: Request, bodyAuth?: string): Promise<AuthTokenSubject | null> {
    const token = this.extractAuthToken(req, bodyAuth);
    if (token === '') {
      return null;
    }
    return this.resolveSubjectSoft(token);
  }

  /**
   * Strong: token must authenticate and trimmed `X-Browser-ID` must equal `browser_uuid`.
   */
  async resolveSubjectStrong(
    authTokenPlaintext: string,
    browserIdHeader: string | undefined,
  ): Promise<AuthTokenSubject | null> {
    const trimmedBrowserId = browserIdHeader?.trim() ?? '';
    if (trimmedBrowserId === '') {
      return null;
    }
    const row = await this.findActiveAuthToken(authTokenPlaintext);
    if (row === null) {
      return null;
    }
    if (row.browserUuid !== trimmedBrowserId) {
      return null;
    }
    return { userId: row.userId };
  }

  /**
   * Strong resolution from Request: extracts token from cookie/body, then validates with browser binding.
   */
  async resolveSubjectStrongFromRequest(
    req: Request,
    browserIdHeader: string | undefined,
    bodyAuth?: string,
  ): Promise<AuthTokenSubject | null> {
    const token = this.extractAuthToken(req, bodyAuth);
    if (token === '') {
      return null;
    }
    return this.resolveSubjectStrong(token, browserIdHeader);
  }

  /**
   * Strong browser binding first; falls back to soft token-only resolution (registration wizard / session bootstrap).
   */
  async resolveSubjectStrongOrSoftFromRequest(
    req: Request,
    browserIdHeader: string | undefined,
    bodyAuth?: string,
  ): Promise<AuthTokenSubject | null> {
    const strongSubject = await this.resolveSubjectStrongFromRequest(req, browserIdHeader, bodyAuth);
    if (strongSubject !== null) {
      return strongSubject;
    }
    return this.resolveSubjectSoftFromRequest(req, bodyAuth);
  }

  private async findActiveAuthToken(authTokenPlaintext: string): Promise<AuthTokenEntity | null> {
    const normalizedPlaintext = authTokenPlaintext.trim();
    if (normalizedPlaintext === '') {
      return null;
    }
    const digest = this.authTokenHmacService.digestPlainTokenHex(normalizedPlaintext);
    const row = await this.authTokenRepository.findOne({
      where: {
        tokenHmac: digest,
        expiredAt: MoreThan(new Date()),
      },
    });
    if (row === null) {
      return null;
    }
    await this.refreshIdleExpiry(row);
    return row;
  }

  /**
   * Sliding-window refresh: extends `expired_at` to `now + idle`, never past `created_at + absoluteMax`.
   * Persisted only when it advances expiry by at least the refresh threshold, to avoid a write per request.
   */
  private async refreshIdleExpiry(row: AuthTokenEntity): Promise<void> {
    if (!(row.createdAt instanceof Date) || !(row.expiredAt instanceof Date)) {
      return;
    }
    const now = Date.now();
    const idleMs = this.authTokenHmacService.resolveIdleTimeoutSeconds() * 1000;
    const absoluteMaxMs = this.authTokenHmacService.resolveAbsoluteMaxSeconds() * 1000;
    const absoluteDeadline = row.createdAt.getTime() + absoluteMaxMs;
    const nextExpiry = Math.min(now + idleMs, absoluteDeadline);
    const advanceMs = nextExpiry - row.expiredAt.getTime();
    if (advanceMs < API_TOKEN_REFRESH_THRESHOLD_SECONDS * 1000) {
      return;
    }
    const nextExpiryDate = new Date(nextExpiry);
    row.expiredAt = nextExpiryDate;
    await this.authTokenRepository.update({ id: row.id }, { expiredAt: nextExpiryDate });
  }
}
