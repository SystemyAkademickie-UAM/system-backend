import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { MoreThan, Repository } from 'typeorm';

import { MAQ_AUTH_COOKIE_NAME } from '../../constants/api-token-constants';
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
   * Extracts auth token from: 1) `maq_auth` cookie, 2) body `auth` field.
   * Returns empty string if neither present.
   */
  extractAuthToken(req: Request, bodyAuth?: string): string {
    const cookieAuth = req.cookies?.[MAQ_AUTH_COOKIE_NAME];
    if (typeof cookieAuth === 'string' && cookieAuth.trim() !== '') {
      return cookieAuth.trim();
    }
    if (typeof bodyAuth === 'string' && bodyAuth.trim() !== '') {
      return bodyAuth.trim();
    }
    return '';
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

  private async findActiveAuthToken(authTokenPlaintext: string): Promise<AuthTokenEntity | null> {
    const normalizedPlaintext = authTokenPlaintext.trim();
    if (normalizedPlaintext === '') {
      return null;
    }
    const digest = this.authTokenHmacService.digestPlainTokenHex(normalizedPlaintext);
    return this.authTokenRepository.findOne({
      where: {
        tokenHmac: digest,
        expiredAt: MoreThan(new Date()),
      },
    });
  }
}
