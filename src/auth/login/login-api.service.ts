import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { SAML_SESSION_COOKIE_NAME } from '../../constants/saml-constants';
import { AuthTokenIssuanceService } from '../api-token/auth-token-issuance.service';
import type { SamlSessionJwtPayload } from '../saml/saml-auth.service';
import { SamlAuthService } from '../saml/saml-auth.service';
import { SamlLinkedUserService } from './saml-linked-user.service';

/**
 * Exchanges the short-lived SAML session cookie for long-lived bearer tokens keyed by browser installs.
 */
@Injectable()
export class LoginApiService {
  constructor(
    private readonly samlAuthService: SamlAuthService,
    private readonly samlLinkedUserService: SamlLinkedUserService,
    private readonly authTokenIssuanceService: AuthTokenIssuanceService,
  ) {}

  /**
   * @returns plaintext opaque token for JSON `{ "auth": "..." }` (transmit only over HTTPS in production).
   */
  async exchangeSamlSessionForOpaqueBearerToken(
    req: Request,
    browserIdHeaderValue: string | undefined,
  ): Promise<{ auth: string }> {
    const trimmedBrowserId = browserIdHeaderValue?.trim() ?? '';
    if (trimmedBrowserId === '') {
      throw new BadRequestException('X-Browser-ID header is required');
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
    const payload = this.samlAuthService.decodeSessionTokenOrNull(cookieString);
    if (payload === null) {
      throw new UnauthorizedException({
        error: 'SAML_SESSION_INVALID',
        message: 'SAML browser session cookie expired or malformed.',
      });
    }
    return this.issueOpaqueTokenFor(trimmedBrowserId, payload);
  }

  private async issueOpaqueTokenFor(
    browserUuid: string,
    payload: SamlSessionJwtPayload,
  ): Promise<{ auth: string }> {
    const userId = await this.samlLinkedUserService.findOrCreateFromSamlSession(payload);
    const plaintext = await this.authTokenIssuanceService.revokeAndMintPlainToken(userId, browserUuid);
    return { auth: plaintext };
  }
}
