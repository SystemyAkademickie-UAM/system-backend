import { BadRequestException, Controller, Get, Logger, Next, Post, Req, Res } from '@nestjs/common';
import passport from 'passport';
import type { NextFunction, Request, Response } from 'express';

import {
  SAML_CONTROLLER_PATH,
  SAML_LOGIN_FORCE_AUTHN_QUERY,
  SAML_LOGIN_FORCE_AUTHN_QUERY_VALUE,
  SAML_SESSION_COOKIE_NAME,
  SAML_STRATEGY_NAME,
} from '../../constants/saml-constants';
import { jwtExpiresInToCookieMaxAgeMs } from './saml-jwt-expiry.util';
import { SamlAuthService, type SamlSessionJwtPayload } from './saml-auth.service';
import { SamlInstitutionRegistry } from './saml-institution.registry';
import { SamlPassportBootstrapService } from './saml-passport-bootstrap.service';
import { SamlConfigService } from './saml-config.service';
import type { SamlSessionUser } from './saml.types';

function samlNotConfiguredResponse() {
  return {
    error: 'SAML_NOT_CONFIGURED',
    message:
      'SAML 2.0 Service Provider environment is incomplete. Set variables listed under docs/api/api.md (SAML_*).',
  };
}

@Controller(SAML_CONTROLLER_PATH)
export class SamlAuthController {
  private readonly logger = new Logger(SamlAuthController.name);

  /** Must match `res.cookie` / `clearCookie` so the browser actually removes `maqSamlSession`. */
  private static sessionCookieBaseOptions(): {
    httpOnly: boolean;
    sameSite: 'lax';
    secure: boolean;
    path: string;
  } {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    };
  }

  constructor(
    private readonly bootstrap: SamlPassportBootstrapService,
    private readonly samlConfig: SamlConfigService,
    private readonly samlAuth: SamlAuthService,
    private readonly institutionRegistry: SamlInstitutionRegistry,
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
    };
  }

  /**
   * Institutions for the SPA “choose university” step (PIONIER.id is `planned` until discovery is integrated).
   */
  @Get('institutions')
  getInstitutions(): { samlReady: boolean; institutions: ReturnType<SamlInstitutionRegistry['listForDisplay']> } {
    return {
      samlReady: this.bootstrap.isReady(),
      institutions: this.institutionRegistry.listForDisplay(this.bootstrap.isReady()),
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
    const forceRaw = req.query[SAML_LOGIN_FORCE_AUTHN_QUERY];
    this.bootstrap.setForceAuthn(forceRaw === SAML_LOGIN_FORCE_AUTHN_QUERY_VALUE);
    const institutionRaw = req.query['institution'];
    const institution = typeof institutionRaw === 'string' ? institutionRaw.trim() : '';
    if (institution.length > 0) {
      if (!this.institutionRegistry.isKnownInstitutionId(institution)) {
        throw new BadRequestException({
          error: 'INVALID_INSTITUTION',
          message: 'Unknown or unsupported institution id.',
        });
      }
      const binding = this.institutionRegistry.resolveBinding(institution);
      if (binding === null) {
        throw new BadRequestException({
          error: 'INSTITUTION_NOT_AVAILABLE',
          message: 'Institution SAML binding could not be loaded (paths / env).',
        });
      }
      this.bootstrap.applyBinding(binding.entryPoint, binding.idpCertPem);
      // @types/passport omits passport-saml `additionalParams` (RelayState for IdP echo + ACS binding).
      passport.authenticate(SAML_STRATEGY_NAME, {
        additionalParams: { RelayState: SamlInstitutionRegistry.relayStateForInstitution(institution) },
      } as never)(req, res, next);
      return;
    }
    this.bootstrap.resetToBaseline();
    passport.authenticate(SAML_STRATEGY_NAME)(req, res, next);
  }

  /** Assertion Consumer Service — receives `SAMLResponse` (HTTP-POST binding). */
  @Post('acs')
  acs(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction): void {
    if (!this.bootstrap.isReady()) {
      res.status(503).json(samlNotConfiguredResponse());
      return;
    }
    this.bootstrap.setForceAuthn(false);
    const relayRaw = req.body?.['RelayState'];
    const relayState = typeof relayRaw === 'string' ? relayRaw : undefined;
    const institutionFromRelay = SamlInstitutionRegistry.parseInstitutionFromRelayState(relayState);
    if (institutionFromRelay !== null) {
      const binding = this.institutionRegistry.resolveBinding(institutionFromRelay);
      if (binding !== null) {
        this.bootstrap.applyBinding(binding.entryPoint, binding.idpCertPem);
      } else {
        this.bootstrap.resetToBaseline();
      }
    } else {
      this.bootstrap.resetToBaseline();
    }
    passport.authenticate(
      SAML_STRATEGY_NAME,
      { session: false },
      (err: unknown, user: false | SamlSessionUser | undefined) => {
        if (err !== null && err !== undefined) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`SAML ACS failed: ${msg}`);
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
        const sessionTtlMs = jwtExpiresInToCookieMaxAgeMs(this.samlConfig.getSessionJwtExpiresIn());
        res.cookie(SAML_SESSION_COOKIE_NAME, token, {
          ...SamlAuthController.sessionCookieBaseOptions(),
          maxAge: sessionTtlMs,
        });
        res.redirect(this.samlConfig.getLoginSuccessRedirectUrl());
      },
    )(req, res, next);
  }

  /**
   * Clears the HTTP-only session JWT cookie issued after ACS (local app logout).
   * Does not perform SAML Single Logout at the IdP — that is a separate integration.
   */
  @Post('logout')
  logout(@Res() res: Response): void {
    res.clearCookie(SAML_SESSION_COOKIE_NAME, SamlAuthController.sessionCookieBaseOptions());
    res.status(204).send();
  }

  /**
   * Smoke / dev helper: reads the HTTP-only session JWT set after ACS.
   * Payload may include `givenName`, `surname`, `uid` when asserted by the IdP.
   */
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
