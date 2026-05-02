import { Controller, Get, Next, Post, Req, Res } from '@nestjs/common';
import type { Profile, SAML } from '@node-saml/node-saml';
import type { Strategy as SamlPassportStrategy } from '@node-saml/passport-saml';
import passport from 'passport';
import type { NextFunction, Request, Response } from 'express';

import { SAML_CONTROLLER_PATH, SAML_SESSION_COOKIE_NAME, SAML_STRATEGY_NAME } from '../../constants/saml-constants';
import { jwtExpiresInToCookieMaxAgeMs } from './saml-jwt-expiry.util';
import { SamlAuthService, type SamlSessionJwtPayload } from './saml-auth.service';
import { toComparableLogoutProfileFromJwt } from './saml-logout-comparable.util';
import { SamlPassportBootstrapService } from './saml-passport-bootstrap.service';
import { SamlConfigService } from './saml-config.service';
import { generateDefaultSpStyleMetadataXml } from './saml-sp-metadata.generator';
import type { SamlSessionUser } from './saml.types';

function getSamlFromPassportStrategy(strategy: SamlPassportStrategy): SAML {
  return (strategy as unknown as { _saml: SAML })._saml;
}

function clearSamlSessionCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(SAML_SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
  });
}

/** Passport calls `req.logout` during IdP-initiated SLO; we do not use persistent passport sessions. */
function attachNoopPassportLogout(req: Request): void {
  Object.assign(req as Request & { logout: (cb?: unknown) => void }, {
    logout(cb?: unknown): void {
      if (typeof cb === 'function') {
        (cb as (err?: Error) => void)();
      }
    },
  });
}

function samlNotConfiguredResponse() {
  return {
    error: 'SAML_NOT_CONFIGURED',
    message:
      'SAML 2.0 Service Provider environment is incomplete. Set variables listed under docs/api.md (SAML_*).',
  };
}

function samlMetadataExportIncompleteResponse() {
  return {
    error: 'SAML_METADATA_EXPORT_INCOMPLETE',
    message:
      'SP metadata uses the UAM default-sp XML shape: set SAML_METADATA_SLO_REDIRECT_URL (e.g. .../api/auth/saml/logout) and SAML_METADATA_TECH_CONTACT_GIVEN_NAME / SAML_METADATA_TECH_CONTACT_EMAIL. See docs/api.md.',
  };
}

@Controller(SAML_CONTROLLER_PATH)
export class SamlAuthController {
  constructor(
    private readonly bootstrap: SamlPassportBootstrapService,
    private readonly samlConfig: SamlConfigService,
    private readonly samlAuth: SamlAuthService,
  ) {}

  /**
   * Human-readable checklist for operators (PIONIER.id / IdP registration).
   */
  @Get('status')
  getStatus(): Record<string, unknown> {
    const complete = this.samlConfig.isConfigurationComplete();
    return {
      samlReady: this.bootstrap.isReady(),
      configurationComplete: complete,
      requirements: this.samlConfig.getRequirementsPresence(),
      pemMaterialLoaded: this.samlConfig.getPemMaterialsLoaded(),
      metadataExportReady: this.samlConfig.isMetadataExportReady(),
      metadataArtifactAcsAdvertised: this.samlConfig.includeArtifactAssertionConsumerServiceInMetadata(),
    };
  }

  /** SP metadata XML for federation registration (PIONIER.id / IdP configuration). */
  @Get('metadata')
  getMetadata(@Res() res: Response): void {
    if (!this.bootstrap.isReady()) {
      res.status(503).json(samlNotConfiguredResponse());
      return;
    }
    if (!this.samlConfig.isMetadataExportReady()) {
      res.status(503).json(samlMetadataExportIncompleteResponse());
      return;
    }
    const sloRedirectUrl = this.samlConfig.getMetadataSloRedirectUrl();
    const technicalContact = this.samlConfig.getSpMetadataTechnicalContact();
    if (sloRedirectUrl === undefined || technicalContact === null) {
      res.status(503).json(samlMetadataExportIncompleteResponse());
      return;
    }
    const xml = generateDefaultSpStyleMetadataXml({
      entityId: this.samlConfig.getSpEntityId(),
      acsUrl: this.samlConfig.getAcsUrl(),
      sloRedirectUrl,
      technicalContact,
      includeArtifactAssertionConsumerService:
        this.samlConfig.includeArtifactAssertionConsumerServiceInMetadata(),
    });
    res.type('application/xml');
    res.send(xml);
  }

  /**
   * Single Logout Service (HTTP-Redirect / HTTP-POST): SP-initiated, IdP-initiated (`SAMLRequest`),
   * and completion (`SAMLResponse` LogoutResponse).
   */
  @Get('logout')
  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction): void {
    if (!this.bootstrap.isReady()) {
      res.status(503).json(samlNotConfiguredResponse());
      return;
    }
    const strategy = this.bootstrap.getStrategy();
    if (strategy === null) {
      res.status(503).json(samlNotConfiguredResponse());
      return;
    }

    const query = req.query as Record<string, string | undefined>;
    const body = req.body as Record<string, string | undefined> | undefined;
    const samlResponse = query.SAMLResponse ?? body?.SAMLResponse;
    const samlRequest = query.SAMLRequest ?? body?.SAMLRequest;

    if (samlResponse !== undefined && samlResponse.length > 0) {
      void this.finalizeWithLogoutResponse(req, strategy, res, next);
      return;
    }

    if (samlRequest !== undefined && samlRequest.length > 0) {
      this.handleIdpLogoutRequest(req, res, next, strategy);
      return;
    }

    this.handleSpInitiatedLogout(req, res, next, strategy);
  }

  /** Starts SAML login — redirects browser to the IdP (HTTP-Redirect binding). */
  @Get('login')
  login(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction): void {
    if (!this.bootstrap.isReady()) {
      res.status(503).json(samlNotConfiguredResponse());
      return;
    }
    passport.authenticate(SAML_STRATEGY_NAME)(req, res, next);
  }

  /** Assertion Consumer Service — receives `SAMLResponse` (HTTP-POST binding). */
  @Post('acs')
  acs(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction): void {
    if (!this.bootstrap.isReady()) {
      res.status(503).json(samlNotConfiguredResponse());
      return;
    }
    passport.authenticate(
      SAML_STRATEGY_NAME,
      { session: false },
      (err: unknown, user: false | SamlSessionUser | undefined) => {
        if (err !== null && err !== undefined) {
          next(err);
          return;
        }
        if (user === undefined || user === false) {
          res.status(401).json({
            error: 'SAML_AUTH_FAILED',
            message: 'SAML authentication failed or was cancelled.',
          });
          return;
        }
        const sessionUser = user as SamlSessionUser;
        const token = this.samlAuth.signSessionToken(sessionUser);
        const isProd = process.env.NODE_ENV === 'production';
        const sessionTtlMs = jwtExpiresInToCookieMaxAgeMs(this.samlConfig.getSessionJwtExpiresIn());
        res.cookie(SAML_SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: isProd,
          maxAge: sessionTtlMs,
        });
        res.redirect(this.samlConfig.getLoginSuccessRedirectUrl());
      },
    )(req, res, next);
  }

  /** Smoke / dev helper: reads the HTTP-only session JWT set after ACS. */
  @Get('me')
  getMe(@Req() req: Request): {
    authenticated: boolean;
    user?: SamlSessionJwtPayload;
  } {
    const raw = req.cookies?.[SAML_SESSION_COOKIE_NAME];
    if (raw === undefined || raw.length === 0) {
      return { authenticated: false };
    }
    const user = this.samlAuth.decodeSessionTokenOrNull(raw);
    if (user === null) {
      return { authenticated: false };
    }
    return { authenticated: true, user };
  }

  private async finalizeWithLogoutResponse(
    req: Request,
    strategy: SamlPassportStrategy,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const saml = getSamlFromPassportStrategy(strategy);
      const body = req.body as Record<string, string> | undefined;
      if (req.method === 'POST' && body?.SAMLResponse !== undefined) {
        await saml.validatePostResponseAsync(body);
      } else {
        const q = req.query as Record<string, string>;
        const originalQuery = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
        await saml.validateRedirectAsync(q, originalQuery);
      }
      clearSamlSessionCookie(res);
      res.redirect(this.samlConfig.getLoginSuccessRedirectUrl());
    } catch (err) {
      next(err);
    }
  }

  private handleIdpLogoutRequest(
    req: Request,
    res: Response,
    next: NextFunction,
    strategy: SamlPassportStrategy,
  ): void {
    const token = req.cookies?.[SAML_SESSION_COOKIE_NAME];
    if (token !== undefined && token.length > 0) {
      const payload = this.samlAuth.decodeSessionTokenOrNull(token);
      if (payload !== null) {
        (req as Request & { user: Profile }).user = toComparableLogoutProfileFromJwt(payload);
      }
    }
    attachNoopPassportLogout(req);
    passport.authenticate(SAML_STRATEGY_NAME, { session: false }, (err: unknown) => {
      if (err !== null && err !== undefined) {
        next(err);
        return;
      }
      clearSamlSessionCookie(res);
      res.redirect(this.samlConfig.getLoginSuccessRedirectUrl());
    })(req, res, next);
  }

  private handleSpInitiatedLogout(
    req: Request,
    res: Response,
    next: NextFunction,
    strategy: SamlPassportStrategy,
  ): void {
    const token = req.cookies?.[SAML_SESSION_COOKIE_NAME];
    if (token === undefined || token.length === 0) {
      res.redirect(this.samlConfig.getLoginSuccessRedirectUrl());
      return;
    }
    const payload = this.samlAuth.decodeSessionTokenOrNull(token);
    if (payload === null) {
      clearSamlSessionCookie(res);
      res.redirect(this.samlConfig.getLoginSuccessRedirectUrl());
      return;
    }
    (req as Request & { user: Profile }).user = toComparableLogoutProfileFromJwt(payload);
    strategy.logout(req as never, (err: Error | null, url?: string | null) => {
      if (err !== null && err !== undefined) {
        next(err);
        return;
      }
      if (url === null || url === undefined) {
        next(new Error('SAML SP-initiated logout failed: missing redirect URL'));
        return;
      }
      clearSamlSessionCookie(res);
      res.redirect(url);
    });
  }
}
