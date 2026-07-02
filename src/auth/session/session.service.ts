import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { MoreThan, Repository } from 'typeorm';

import {
  MAQ_SESSION_COOKIE_NAME,
  LEGACY_MAQ_AUTH_COOKIE_NAME,
  SESSION_REFRESH_THRESHOLD_SECONDS,
} from '../../constants/session-constants';
import { SessionEntity } from '../../database/entities/session.entity';
import { SessionHmacService } from './session-hmac.service';

export type SessionSubject = {
  userId: number;
  activeRole: string | null;
  sessionId: number;
  /** Tenant from login (SAML / magic link). Required for org-scoped API behavior. */
  organizationId: number | null;
};

/**
 * Resolves the user bound to a row in `auth.sessions` via stored HMAC digests.
 * Simplified from the old SessionService: no more strong/soft distinction or browser binding.
 */
@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessionRepository: Repository<SessionEntity>,
    private readonly sessionHmacService: SessionHmacService) {}

  /**
   * Extracts session token from: 1) `maq_session` cookie, 2) legacy `maq_auth` cookie,
   * 3) `Authorization: Bearer` header, 4) body `auth` field.
   * The token is intentionally never read from the URL query string (leaks via logs/Referer/history).
   * Returns empty string if none present.
   */
  extractSessionToken(req: Request, bodyAuth?: string): string {
    const sessionCookie = req.cookies?.[MAQ_SESSION_COOKIE_NAME];
    if (typeof sessionCookie === 'string' && sessionCookie.trim() !== '') {
      return sessionCookie.trim();
    }
    const legacyCookie = req.cookies?.[LEGACY_MAQ_AUTH_COOKIE_NAME];
    if (typeof legacyCookie === 'string' && legacyCookie.trim() !== '') {
      return legacyCookie.trim();
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

  private extractBearerToken(req: Request): string {
    const header = req.headers?.authorization;
    if (typeof header !== 'string') {
      return '';
    }
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match ? match[1].trim() : '';
  }

  /**
   * Resolves the authenticated user from request. Single unified method replacing
   * the old resolveSubjectStrong/Soft/StrongOrSoft split.
   */
  async resolveSubjectFromRequest(req: Request, bodyAuth?: string): Promise<SessionSubject | null> {
    const token = this.extractSessionToken(req, bodyAuth);
    if (token === '') {
      return null;
    }
    return this.resolveSubject(token);
  }

  /**
   * Resolves subject from plaintext session id.
   */
  async resolveSubject(plaintextSession: string): Promise<SessionSubject | null> {
    const row = await this.findActiveSession(plaintextSession);
    if (row === null) {
      return null;
    }
    return {
      userId: row.userId,
      activeRole: row.activeRole,
      sessionId: row.id,
      organizationId: row.organizationId,
    };
  }

  /**
   * Gets the full session row for a plaintext session id (needed for SAML SLO).
   */
  async getSessionRow(plaintextSession: string): Promise<SessionEntity | null> {
    return this.findActiveSession(plaintextSession);
  }

  private async findActiveSession(plaintextSession: string): Promise<SessionEntity | null> {
    const normalizedPlaintext = plaintextSession.trim();
    if (normalizedPlaintext === '') {
      return null;
    }
    const digest = this.sessionHmacService.digestPlainSessionHex(normalizedPlaintext);
    const row = await this.sessionRepository.findOne({
      where: {
        sessionHmac: digest,
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
  private async refreshIdleExpiry(row: SessionEntity): Promise<void> {
    if (!(row.createdAt instanceof Date) || !(row.expiredAt instanceof Date)) {
      return;
    }
    const now = Date.now();
    const idleMs = this.sessionHmacService.resolveIdleTimeoutSeconds() * 1000;
    const absoluteMaxMs = this.sessionHmacService.resolveAbsoluteMaxSeconds() * 1000;
    const absoluteDeadline = row.createdAt.getTime() + absoluteMaxMs;
    const nextExpiry = Math.min(now + idleMs, absoluteDeadline);
    const advanceMs = nextExpiry - row.expiredAt.getTime();
    if (advanceMs < SESSION_REFRESH_THRESHOLD_SECONDS * 1000) {
      return;
    }
    const nextExpiryDate = new Date(nextExpiry);
    row.expiredAt = nextExpiryDate;
    await this.sessionRepository.update({ id: row.id }, { expiredAt: nextExpiryDate });
  }
}
