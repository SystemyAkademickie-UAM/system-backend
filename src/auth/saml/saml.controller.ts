import { Controller, Get, Post, Req, Res, Logger } from '@nestjs/common';
import { Strategy, type VerifiedCallback } from '@node-saml/passport-saml';
import type { Profile } from '@node-saml/node-saml';
import type { Request, Response } from 'express';
import passport from 'passport';

import { SamlConfigService } from './saml-config.service';
import { SamlService } from './saml.service';
import type { SamlUser } from './saml.types';

const SAML_STRATEGY_NAME = 'saml';
const SESSION_COOKIE_NAME = 'saml_session';

@Controller('auth/saml')
export class SamlController {
  private readonly logger = new Logger(SamlController.name);
  private strategy: Strategy | null = null;

  constructor(
    private readonly samlConfig: SamlConfigService,
    private readonly samlService: SamlService,
  ) {
    this.initializeStrategy();
  }

  private initializeStrategy(): void {
    if (!this.samlConfig.isConfigured()) {
      this.logger.warn('SAML not fully configured. Auth endpoints will return 503.');
      return;
    }

    try {
      const config = this.samlConfig.buildSamlConfig();
      const samlService = this.samlService;
      
      this.strategy = new Strategy(
        config,
        function signonVerify(profile: Profile | null, done: VerifiedCallback) {
          const user = samlService.mapProfileToUser(profile);
          if (!user) {
            done(new Error('Failed to map SAML profile'));
            return;
          }
          done(null, user as unknown as Record<string, unknown>);
        },
        function logoutVerify(_profile: Profile | null, done: VerifiedCallback) {
          done(null, undefined);
        },
      );
      passport.use(SAML_STRATEGY_NAME, this.strategy as unknown as passport.Strategy);
      this.logger.log('SAML strategy initialized');
    } catch (err) {
      this.logger.error('Failed to initialize SAML strategy', err);
    }
  }

  @Get('status')
  getStatus(): { configured: boolean; entityId?: string } {
    return {
      configured: this.samlConfig.isConfigured(),
      entityId: this.samlConfig.isConfigured() ? this.samlConfig.getSpEntityId() : undefined,
    };
  }

  @Get('metadata')
  getMetadata(@Res() res: Response): void {
    if (!this.strategy) {
      res.status(503).json({ error: 'SAML_NOT_CONFIGURED' });
      return;
    }
    const cert = this.samlConfig.getSpCert();
    const metadata = this.strategy.generateServiceProviderMetadata(cert, cert);
    res.type('application/xml').send(metadata);
  }

  @Get('login')
  login(@Req() req: Request, @Res() res: Response): void {
    if (!this.strategy) {
      res.status(503).json({ error: 'SAML_NOT_CONFIGURED' });
      return;
    }
    passport.authenticate(SAML_STRATEGY_NAME)(req, res, (err: unknown) => {
      if (err) {
        this.logger.error('SAML login error', err);
        res.status(500).json({ error: 'SAML_LOGIN_ERROR' });
      }
    });
  }

  @Post('acs')
  handleAcs(@Req() req: Request, @Res() res: Response): void {
    if (!this.strategy) {
      res.status(503).json({ error: 'SAML_NOT_CONFIGURED' });
      return;
    }

    passport.authenticate(
      SAML_STRATEGY_NAME,
      { session: false },
      (err: unknown, user: unknown) => {
        if (err) {
          this.logger.error('ACS error', err);
          res.status(401).json({ error: 'SAML_AUTH_FAILED' });
          return;
        }
        if (!user) {
          res.status(401).json({ error: 'SAML_NO_USER' });
          return;
        }

        const token = this.samlService.signSessionToken(user as SamlUser);
        const isProd = process.env.NODE_ENV === 'production';
        
        res.cookie(SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          secure: isProd,
          sameSite: 'lax',
          maxAge: 8 * 60 * 60 * 1000, // 8 hours
        });

        res.redirect(this.samlConfig.getLoginSuccessUrl());
      },
    )(req, res);
  }

  @Get('me')
  getMe(@Req() req: Request): { authenticated: boolean; user?: unknown } {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token) {
      return { authenticated: false };
    }
    const user = this.samlService.verifySessionToken(token);
    if (!user) {
      return { authenticated: false };
    }
    return { authenticated: true, user };
  }

  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response): void {
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ success: true });
  }

  /**
   * SAML Single Logout - generates a SAML LogoutRequest and redirects to IdP.
   * After logout at IdP, user will be redirected back to /slo callback.
   */
  @Get('logout')
  samlLogout(@Req() req: Request, @Res() res: Response): void {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    const session = token ? this.samlService.verifySessionToken(token) : null;
    
    // Clear local session first
    res.clearCookie(SESSION_COOKIE_NAME);

    // If no strategy or no IdP logout configured, just redirect
    if (!this.strategy || !this.samlConfig.getIdpLogoutUrl()) {
      res.redirect(this.samlConfig.getLogoutUrl());
      return;
    }

    // If no valid session, can't build proper LogoutRequest
    if (!session?.sub) {
      this.logger.warn('No valid session for SAML logout, redirecting to home');
      res.redirect(this.samlConfig.getLogoutUrl());
      return;
    }

    // Build user object for passport-saml logout (needs nameID and nameIDFormat)
    const samlUser = {
      nameID: session.sub,
      nameIDFormat: session.nameIdFormat || 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
      sessionIndex: session.sessionIndex,
    };

    // Attach user to request for passport-saml
    (req as unknown as { user: typeof samlUser }).user = samlUser;

    // Use passport-saml to generate proper LogoutRequest
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.strategy.logout as any)(
      req,
      (err: Error | null, logoutUrl?: string | null) => {
        if (err) {
          this.logger.error('Failed to generate SAML LogoutRequest', err);
          res.redirect(this.samlConfig.getLogoutUrl());
          return;
        }
        if (logoutUrl) {
          this.logger.log(`Redirecting to IdP logout: ${logoutUrl}`);
          res.redirect(logoutUrl);
        } else {
          res.redirect(this.samlConfig.getLogoutUrl());
        }
      },
    );
  }

  /**
   * SLO callback - called by IdP after logout completes.
   * Handles both GET and POST bindings with SAML LogoutResponse validation.
   */
  @Get('slo')
  handleSloGet(@Req() req: Request, @Res() res: Response): void {
    this.handleSloCallback(req, res);
  }

  @Post('slo')
  handleSloPost(@Req() req: Request, @Res() res: Response): void {
    this.handleSloCallback(req, res);
  }

  private handleSloCallback(_req: Request, res: Response): void {
    // Clear session cookie and redirect to frontend
    res.clearCookie(SESSION_COOKIE_NAME);
    res.redirect(this.samlConfig.getLogoutUrl());
  }
}
