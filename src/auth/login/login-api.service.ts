import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';

import {
  MAQ_ACTIVE_ROLE_COOKIE_NAME,
  MAQ_AUTH_COOKIE_NAME,
} from '../../constants/api-token-constants';
import { BROWSER_ID_UUID_REGEX } from '../../constants/browser-id-constants';
import { SAML_SESSION_COOKIE_NAME } from '../../constants/saml-constants';
import { buildSamlSessionCookieOptions } from '../saml/saml-cookie-options.util';
import { UserEntity } from '../../database/entities/user.entity';
import { UserRolesService } from '../../user-roles/user-roles-service';
import { AuthTokenIssuanceService } from '../api-token/auth-token-issuance.service';
import { AuthTokenSessionService } from '../api-token/auth-token-session-service';
import { SamlService } from '../saml/saml.service';
import type { SamlSessionPayload } from '../saml/saml.types';
import { SamlLinkedUserService } from './saml-linked-user.service';

export type LoginMeResponse = {
  authenticated: boolean;
  user?: {
    sub: string;
    email: string;
    givenName?: string;
    surname?: string;
    displayName?: string;
    /** Active role: the selected role if valid, otherwise the highest-privilege role. */
    role?: string;
    /** All roles the user holds (highest to lowest privilege). */
    availableRoles?: string[];
  };
};

/**
 * Exchanges the short-lived SAML session cookie for long-lived bearer tokens keyed by browser installs.
 */
@Injectable()
export class LoginApiService {
  constructor(
    private readonly samlService: SamlService,
    private readonly samlLinkedUserService: SamlLinkedUserService,
    private readonly authTokenIssuanceService: AuthTokenIssuanceService,
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
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
    return this.issueOpaqueTokenFor(req, res, trimmedBrowserId, payload);
  }

  /**
   * JWT may carry a stale `userId` after DB resets; verify the row exists before minting tokens.
   */
  private async resolveUserIdForToken(payload: SamlSessionPayload): Promise<number> {
    const jwtUserId = payload.userId;
    if (jwtUserId !== undefined && Number.isFinite(jwtUserId) && jwtUserId > 0) {
      const userExists = await this.userRepository.exists({ where: { id: jwtUserId } });
      if (userExists) {
        return jwtUserId;
      }
    }
    return this.samlLinkedUserService.findOrCreateFromSamlSession(payload);
  }

  private async issueOpaqueTokenFor(
    req: Request,
    res: Response,
    browserUuid: string,
    payload: SamlSessionPayload,
  ): Promise<{ auth: string }> {
    const userId = await this.resolveUserIdForToken(payload);
    const plaintext = await this.authTokenIssuanceService.revokeAndMintPlainToken(userId, browserUuid);
    res.cookie(MAQ_AUTH_COOKIE_NAME, plaintext, buildSamlSessionCookieOptions(req));
    return { auth: plaintext };
  }

  /** Clears opaque auth, active-role, and SAML session cookies for browser clients. */
  clearAuthCookies(res: Response): { success: true } {
    res.clearCookie(MAQ_AUTH_COOKIE_NAME, { path: '/' });
    res.clearCookie(MAQ_ACTIVE_ROLE_COOKIE_NAME, { path: '/' });
    res.clearCookie(SAML_SESSION_COOKIE_NAME, { path: '/' });
    return { success: true };
  }

  /** Revokes the current `maq_auth` row (if any), then clears browser cookies. */
  async clearAuthCookiesAndRevokeToken(req: Request, res: Response): Promise<{ success: true }> {
    const token = this.authTokenSessionService.extractAuthToken(req);
    if (token !== '') {
      await this.authTokenIssuanceService.revokePlainToken(token);
    }
    return this.clearAuthCookies(res);
  }

  /**
   * Issues `maq_auth` after SAML ACS when browser id was carried in RelayState.
   */
  async mintAuthCookieFromSamlPayload(
    req: Request,
    res: Response,
    payload: SamlSessionPayload,
    browserUuid: string,
  ): Promise<void> {
    await this.issueOpaqueTokenFor(req, res, browserUuid.trim(), payload);
  }

  /**
   * Session check for browser clients that already hold `maq_auth` (e.g. after ACS mint).
   * Requires `X-Browser-ID` bound to the token row.
   */
  async resolveAuthenticatedUserFromApiToken(
    req: Request,
    browserIdHeaderValue: string | undefined,
    overrideRole?: string,
  ): Promise<LoginMeResponse> {
    let subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserIdHeaderValue,
      undefined,
    );
    if (!subject) {
      subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, undefined);
    }
    if (!subject) {
      return { authenticated: false };
    }
    const user = await this.userRepository.findOne({ where: { id: subject.userId } });
    if (!user) {
      return { authenticated: false };
    }
    const availableRoles = await this.userRolesService.listRolesForUser(subject.userId);
    const activeRole = this.resolveActiveRole(req, availableRoles, overrideRole);
    const displayName =
      user.nickname.trim().length > 0
        ? user.nickname.trim()
        : `${user.name} ${user.surname}`.trim();
    return {
      authenticated: true,
      user: {
        sub: String(user.id),
        email: user.email,
        givenName: user.name,
        surname: user.surname,
        displayName,
        role: activeRole ?? undefined,
        availableRoles,
      },
    };
  }

  /**
   * Selects the active role for the current user; the role must be one they hold.
   * Persists the choice in the `maq_active_role` cookie and returns the updated session view.
   */
  async setActiveRole(
    req: Request,
    res: Response,
    browserIdHeaderValue: string | undefined,
    requestedRole: string,
  ): Promise<LoginMeResponse> {
    const subject = await this.authTokenSessionService.resolveSubjectStrongOrSoftFromRequest(
      req,
      browserIdHeaderValue,
      undefined,
    );
    if (!subject) {
      throw new UnauthorizedException('Not authenticated');
    }
    const normalizedRole = requestedRole.trim();
    const availableRoles = await this.userRolesService.listRolesForUser(subject.userId);
    if (!availableRoles.includes(normalizedRole)) {
      throw new BadRequestException(`Role "${normalizedRole}" is not assigned to this user`);
    }
    res.cookie(MAQ_ACTIVE_ROLE_COOKIE_NAME, normalizedRole, buildSamlSessionCookieOptions(req));
    return this.resolveAuthenticatedUserFromApiToken(req, browserIdHeaderValue, normalizedRole);
  }

  /** Active role from cookie when valid, else highest-privilege role. */
  private resolveActiveRole(req: Request, availableRoles: string[], overrideRole?: string): string | null {
    if (overrideRole !== undefined && availableRoles.includes(overrideRole)) {
      return overrideRole;
    }
    const cookieRole = req.cookies?.[MAQ_ACTIVE_ROLE_COOKIE_NAME];
    if (typeof cookieRole === 'string' && availableRoles.includes(cookieRole.trim())) {
      return cookieRole.trim();
    }
    return availableRoles[0] ?? null;
  }
}
