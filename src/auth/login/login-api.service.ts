import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  API_TOKEN_DEFAULT_TTL_SECONDS,
  MAQ_AUTH_COOKIE_NAME,
} from '../../constants/api-token-constants';
import { BROWSER_ID_UUID_REGEX } from '../../constants/browser-id-constants';
import { SAML_SESSION_COOKIE_NAME } from '../../constants/saml-constants';
import { AuthTokenHmacService } from '../api-token/auth-token-hmac.service';
import { AuthTokenIssuanceService } from '../api-token/auth-token-issuance.service';
import { SamlService } from '../saml/saml.service';
import type { SamlSessionPayload } from '../saml/saml.types';
import { SamlLinkedUserService } from './saml-linked-user.service';

/**
 * Exchanges the short-lived SAML session cookie for long-lived bearer tokens keyed by browser installs.
 */
@Injectable()
export class LoginApiService {
  constructor(
    private readonly samlService: SamlService,
    private readonly samlLinkedUserService: SamlLinkedUserService,
    private readonly authTokenIssuanceService: AuthTokenIssuanceService,
    private readonly authTokenHmacService: AuthTokenHmacService,
  ) {}

  /**
   * Issues an auth token, sets it as HTTP-only cookie, and returns it in JSON.
   * Browser clients use the cookie automatically; API clients use the JSON `auth` field.
   */
  async exchangeSamlSessionForOpaqueBearerToken(
    req: Request,
    res: Response,
    browserIdHeaderValue: string | undefined,
  ): Promise<{ auth: string }> {
    const trimmedBrowserId = browserIdHeaderValue?.trim() ?? '';
    if (trimmedBrowserId === '') {
      throw new BadRequestException('X-Browser-ID header is required');
    }
    if (!BROWSER_ID_UUID_REGEX.test(trimmedBrowserId)) {
      throw new BadRequestException('X-Browser-ID must be a UUID (RFC 4122)');
    }
    const rawCookieValue = req.cookies?.[SAML_SESSION_COOKIE_NAME];
    const cookieString =
      typeof rawCookieValue === 'string' ? rawCookieValue.trim() : String(rawCookieValue ?? '').trim();
    if (cookieString === '') {
      throw new UnauthorizedException({
        error: 'SAML_SESSION_REQUIRED',
        message:
          'An institutional SSO session cookie is required. Complete SAML authentication, then POST here.',
      });
    }
    const payload = this.samlService.verifySessionToken(cookieString);
    if (payload === null) {
      throw new UnauthorizedException({
        error: 'SAML_SESSION_INVALID',
        message: 'SAML browser session cookie expired or malformed.',
      });
    }
    return this.issueOpaqueTokenFor(res, trimmedBrowserId, payload);
  }

  private async issueOpaqueTokenFor(
    res: Response,
    browserUuid: string,
    payload: SamlSessionPayload,
  ): Promise<{ auth: string }> {
    const userId = await this.samlLinkedUserService.findOrCreateFromSamlSession(payload);
    const plaintext = await this.authTokenIssuanceService.revokeAndMintPlainToken(userId, browserUuid);
    const ttlSeconds = this.authTokenHmacService.resolveExpiresAfterSeconds();
    const maxAgeMs = (ttlSeconds > 0 ? ttlSeconds : API_TOKEN_DEFAULT_TTL_SECONDS) * 1000;
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(MAQ_AUTH_COOKIE_NAME, plaintext, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: maxAgeMs,
      path: '/',
    });
    return { auth: plaintext };
  }
}
