import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';

import {
  LEGACY_MAQ_ACTIVE_ROLE_COOKIE_NAME,
  LEGACY_MAQ_AUTH_COOKIE_NAME,
  MAQ_SESSION_COOKIE_NAME,
  SESSION_ABSOLUTE_MAX_DEFAULT_SECONDS,
} from '../../constants/session-constants';
import { SAML_PENDING_ORG_COOKIE_NAME, SAML_SESSION_COOKIE_NAME } from '../../constants/saml-constants';
import { buildSamlSessionCookieOptions, buildClearSamlCookieOptions, resolvePendingOrgCookieSameSite } from '../saml/saml-cookie-options.util';
import { UserEntity } from '../../database/entities/user.entity';
import { UserRolesService } from '../../user-roles/user-roles-service';
import { SessionService } from '../session/session.service';
import { SessionIssuanceService, CreateSessionOptions } from '../session/session-issuance.service';
import { LoginContextService, LoginMembership } from './login-context.service';

export type LoginMeResponse = {
  authenticated: boolean;
  user?: {
    sub: string;
    email: string;
    givenName?: string;
    surname?: string;
    displayName?: string;
    /** Active role for this session. Omitted until the user confirms a choice. */
    role?: string;
    /** All roles the user holds (highest to lowest privilege). */
    availableRoles?: string[];
    /** Organization bound to this session. */
    organizationId?: number | null;
    /** True when the user must confirm an organization and role before continuing. */
    selectionRequired?: boolean;
    /** Active organizations and the roles held in each. */
    memberships?: LoginMembership[];
  };
};

export type EstablishSessionOptions = {
  userId: number;
  loginMethod: 'saml' | 'magic_link';
  organizationId?: number | null;
  samlNameId?: string | null;
  samlNameIdFormat?: string | null;
  samlSessionIndex?: string | null;
  rememberMe?: boolean;
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
    private readonly loginContextService: LoginContextService,
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
    await this.loginContextService.applyOnLogin(
      plaintext,
      options.userId,
      options.organizationId ?? null,
    );
    const rawRemember = req.cookies?.['maq_remember_me'];
    const isRememberMe = options.rememberMe ?? (rawRemember === '1' || rawRemember === 'true');
    const maxAgeMs = isRememberMe ? SESSION_ABSOLUTE_MAX_DEFAULT_SECONDS * 1000 : undefined;
    res.cookie(MAQ_SESSION_COOKIE_NAME, plaintext, buildSamlSessionCookieOptions(req, maxAgeMs));
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
    const described = await this.loginContextService.describe(
      subject.userId,
      subject.organizationId,
      subject.activeRole,
    );
    const organizationRoles = described.memberships.find(
      (membership) => membership.organizationId === subject.organizationId,
    )?.roles ?? [];
    const sessionRole = subject.activeRole !== null && organizationRoles.includes(subject.activeRole)
      ? subject.activeRole
      : null;
    let activeRole = sessionRole;
    if (overrideRole !== undefined && organizationRoles.includes(overrideRole)) {
      activeRole = overrideRole;
    } else if (activeRole === null && !described.selectionRequired) {
      activeRole = availableRoles[0] ?? null;
    }
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
        organizationId: subject.organizationId,
        selectionRequired: described.selectionRequired,
        memberships: described.memberships,
      },
    };
  }

  /**
   * Confirms the organization and role for this session and remembers them for the next login.
   */
  async selectLoginContext(
    req: Request,
    organizationId: number,
    role: string,
  ): Promise<LoginMeResponse> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, undefined);
    if (!subject) {
      throw new UnauthorizedException('Not authenticated');
    }
    const token = this.sessionService.extractSessionToken(req);
    const normalizedRole = role.trim();
    await this.loginContextService.select(
      token,
      subject.userId,
      organizationId,
      normalizedRole,
    );
    return this.resolveAuthenticatedUser(req, normalizedRole);
  }

  /**
   * Selects the active role inside the session organization.
   * A role held only in another organization is rejected.
   */
  async setActiveRole(
    req: Request,
    requestedRole: string): Promise<LoginMeResponse> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, undefined);
    if (!subject) {
      throw new UnauthorizedException('Not authenticated');
    }
    const normalizedRole = requestedRole.trim();
    const memberships = await this.loginContextService.listMemberships(subject.userId);
    const membership = memberships.find(
      (item) => item.organizationId === subject.organizationId,
    );
    if (!membership || !membership.roles.includes(normalizedRole)) {
      throw new BadRequestException(
        `Role "${normalizedRole}" is not assigned in this organization`,
      );
    }
    const token = this.sessionService.extractSessionToken(req);
    await this.sessionIssuanceService.setActiveRole(token, normalizedRole);
    return this.resolveAuthenticatedUser(req, normalizedRole);
  }
}
