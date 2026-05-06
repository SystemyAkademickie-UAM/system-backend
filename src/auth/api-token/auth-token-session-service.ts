import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';

import { AuthTokenEntity } from '../../database/entities/auth-token.entity';
import { AuthTokenHmacService } from './auth-token-hmac.service';

export type AuthTokenSubject = { userId: number };

/**
 * Resolves the user bound to a row in `auth_tokens` via stored HMAC digests (no role checks).
 */
@Injectable()
export class AuthTokenSessionService {
  constructor(
    @InjectRepository(AuthTokenEntity)
    private readonly authTokenRepository: Repository<AuthTokenEntity>,
    private readonly authTokenHmacService: AuthTokenHmacService,
  ) {}

  /**
   * Soft: token must authenticate to a non-expired row; browser header is ignored.
   */
  async resolveSubjectSoft(authTokenPlaintext: string): Promise<AuthTokenSubject | null> {
    const row = await this.findActiveAuthToken(authTokenPlaintext);
    return row !== null ? { userId: row.userId } : null;
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

  private async findActiveAuthToken(authTokenPlaintext: string): Promise<AuthTokenEntity | null> {
    const normalizedPlaintext = authTokenPlaintext.trim();
    if (normalizedPlaintext === '') {
      return null;
    }
    const digest = this.authTokenHmacService.digestPlainTokenHex(normalizedPlaintext);
    return this.authTokenRepository.findOne({
      where: {
        tokenHmac: digest,
        expiresAt: MoreThan(new Date()),
      },
    });
  }
}
