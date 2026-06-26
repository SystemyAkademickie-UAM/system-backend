import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';

import {
  LEGACY_MAQ_ACTIVE_ROLE_COOKIE_NAME,
  LEGACY_MAQ_AUTH_COOKIE_NAME,
  MAQ_SESSION_COOKIE_NAME,
} from '../../constants/session-constants';
import { SAML_PENDING_ORG_COOKIE_NAME, SAML_SESSION_COOKIE_NAME } from '../../constants/saml-constants';
import { buildSamlSessionCookieOptions, buildClearSamlCookieOptions, resolvePendingOrgCookieSameSite } from '../saml/saml-cookie-options.util';
import { UserEntity } from '../../database/entities/user.entity';
import { UserRolesService } from '../../user-roles/user-roles-service';
import { SessionService } from '../session/session.service';
import { SessionIssuanceService, CreateSessionOptions } from '../session/session-issuance.service';

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

export type EstablishSessionOptions = {
  userId: number;
  loginMethod: 'saml' | 'magic_link';
  organizationId?: number | null;
  samlNameId?: string | null;
  samlNameIdFormat?: string | null;
  samlSessionIndex?: string | null;
};

/**
 * Session management service for login/logout and session introspection.
 * Replaced the old SessionService with the new unified SessionService.
 */
@Injectable()
export class LoginApiService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly sessionIssuanceService: SessionIssuanceService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>) {}

  /**
   * Creates a new session for the user and sets the HttpOnly cookie.
   * Used by both SAML ACS and magic link verify.
   * Returns the plaintext session id for non-browser clients.
   */
  async establishSession(
    req: Request,
    res: Response,
    options: EstablishSessionOptions): Promise<{ session: string }> {
    const sessionOptions: CreateSessionOptions = {
      userId: options.userId,
      loginMethod: options.loginMethod,
      organizationId: options.organizationId ?? null,
      samlNameId: options.samlNameId ?? null,
      samlNameIdFormat: options.samlNameIdFormat ?? null,
      samlSessionIndex: options.samlSessionIndex ?? null,
    };
    const plaintext = await this.sessionIssuanceService.mintSession(sessionOptions);
    res.cookie(MAQ_SESSION_COOKIE_NAME, plaintext, buildSamlSessionCookieOptions(req));
    return { session: plaintext };
  }

  /** Clears all auth cookies (new and legacy) for browser clients. */
  clearAuthCookies(req: Request, res: Response): { success: true } {
    const sessionClearOptions = buildClearSamlCookieOptions(req, 'lax');
    const pendingOrgClearOptions = buildClearSamlCookieOptions(
      req,
      resolvePendingOrgCookieSameSite(req));
    res.clearCookie(MAQ_SESSION_COOKIE_NAME, sessionClearOptions);
    res.clearCookie(LEGACY_MAQ_AUTH_COOKIE_NAME, sessionClearOptions);
    res.clearCookie(LEGACY_MAQ_ACTIVE_ROLE_COOKIE_NAME, sessionClearOptions);
    res.clearCookie(SAML_SESSION_COOKIE_NAME, sessionClearOptions);
    res.clearCookie(SAML_PENDING_ORG_COOKIE_NAME, pendingOrgClearOptions);
    return { success: true };
  }

  /** Revokes the current session (if any), then clears browser cookies. */
  async clearAuthCookiesAndRevokeSession(req: Request, res: Response): Promise<{ success: true }> {
    const token = this.sessionService.extractSessionToken(req);
    if (token !== '') {
      await this.sessionIssuanceService.revokeSession(token);
    }
    return this.clearAuthCookies(req, res);
  }

  /**
   * Session check for browser clients. No browser ID required.
   */
  async resolveAuthenticatedUser(
    req: Request,
    overrideRole?: string): Promise<LoginMeResponse> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, undefined);
    if (!subject) {
      return { authenticated: false };
    }
    const user = await this.userRepository.findOne({ where: { id: subject.userId } });
    if (!user) {
      return { authenticated: false };
    }
    const availableRoles = await this.userRolesService.listRolesForUser(subject.userId);
    const activeRole = this.resolveActiveRole(subject.activeRole, availableRoles, overrideRole);
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
   * Persists the choice in the session row (not a cookie).
   */
  async setActiveRole(
    req: Request,
    requestedRole: string): Promise<LoginMeResponse> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, undefined);
    if (!subject) {
      throw new UnauthorizedException('Not authenticated');
    }
    const normalizedRole = requestedRole.trim();
    const availableRoles = await this.userRolesService.listRolesForUser(subject.userId);
    if (!availableRoles.includes(normalizedRole)) {
      throw new BadRequestException(`Role "${normalizedRole}" is not assigned to this user`);
    }
    const token = this.sessionService.extractSessionToken(req);
    await this.sessionIssuanceService.setActiveRole(token, normalizedRole);
    return this.resolveAuthenticatedUser(req, normalizedRole);
  }

  /**
   * Active role priority: override > session row > first available (highest privilege).
   */
  private resolveActiveRole(
    sessionRole: string | null,
    availableRoles: string[],
    overrideRole?: string): string | null {
    if (overrideRole !== undefined && availableRoles.includes(overrideRole)) {
      return overrideRole;
    }
    if (sessionRole !== null && availableRoles.includes(sessionRole)) {
      return sessionRole;
    }
    return availableRoles[0] ?? null;
  }
}
