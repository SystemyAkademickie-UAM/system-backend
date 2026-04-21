import { Controller, Get, Next, Post, Req, Res } from '@nestjs/common';
import passport from 'passport';
import type { NextFunction, Request, Response } from 'express';

import { SAML_CONTROLLER_PATH, SAML_SESSION_COOKIE_NAME, SAML_STRATEGY_NAME } from '../../constants/saml-constants';
import { jwtExpiresInToCookieMaxAgeMs } from './saml-jwt-expiry.util';
import { SamlAuthService, type SamlSessionJwtPayload } from './saml-auth.service';
import { SamlPassportBootstrapService } from './saml-passport-bootstrap.service';
import { SamlConfigService } from './saml-config.service';
import type { SamlSessionUser } from './saml.types';

function samlNotConfiguredResponse() {
  return {
    error: 'SAML_NOT_CONFIGURED',
    message:
      'SAML 2.0 Service Provider environment is incomplete. Set variables listed under docs/api.md (SAML_*).',
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
    };
  }

  /** SP metadata XML for federation registration (PIONIER.id / IdP configuration). */
  @Get('metadata')
  getMetadata(@Res() res: Response): void {
    if (!this.bootstrap.isReady()) {
      res.status(503).json(samlNotConfiguredResponse());
      return;
    }
    const strategy = this.bootstrap.getStrategy();
    const signingCert = this.samlConfig.getSpPublicCert();
    if (strategy === null || signingCert === undefined) {
      res.status(503).json(samlNotConfiguredResponse());
      return;
    }
    const xml = strategy.generateServiceProviderMetadata(signingCert, signingCert);
    res.type('application/xml');
    res.send(xml);
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
}
