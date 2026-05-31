import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Logger,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  forwardRef,
} from '@nestjs/common';
import { Strategy, type VerifiedCallback } from '@node-saml/passport-saml';
import type { Profile } from '@node-saml/node-saml';
import type { Request, Response } from 'express';
import passport from 'passport';

import { BROWSER_ID_UUID_REGEX } from '../../constants/browser-id-constants';
import { MAQ_AUTH_COOKIE_NAME } from '../../constants/api-token-constants';
import {
  SAML_PENDING_ORG_COOKIE_MAX_AGE_MS,
  SAML_PENDING_ORG_COOKIE_NAME,
  SAML_SESSION_COOKIE_NAME,
} from '../../constants/saml-constants';
import { jwtExpiresInToCookieMaxAgeMs } from './saml-jwt-expiry.util';
import { LoginApiService } from '../login/login-api.service';
import { SamlAccountProvisioningService } from './saml-account-provisioning.service';
import { SamlConfigService } from './saml-config.service';
import {
  SamlOrganizationConfigService,
  type OrganizationSamlConfig,
} from './saml-organization-config.service';
import { SamlOrganizationsService } from './saml-organizations.service';
import { SamlService } from './saml.service';
import type { SamlUser } from './saml.types';
import { formatSamlRelayState, parseSamlRelayState } from './saml-relay-state.util';

const SAML_STRATEGY_PREFIX = 'saml-org-';

@Controller('auth/saml')
export class SamlController {
  private readonly logger = new Logger(SamlController.name);
  private metadataStrategy: Strategy | null = null;
  private readonly organizationStrategies = new Map<number, Strategy>();

  constructor(
    private readonly samlConfig: SamlConfigService,
    private readonly samlService: SamlService,
    private readonly samlOrganizationsService: SamlOrganizationsService,
    private readonly samlOrganizationConfigService: SamlOrganizationConfigService,
    private readonly samlAccountProvisioningService: SamlAccountProvisioningService,
    @Inject(forwardRef(() => LoginApiService))
    private readonly loginApiService: LoginApiService,
  ) {
    this.initializeMetadataStrategy();
  }

  private initializeMetadataStrategy(): void {
    if (!this.samlConfig.isConfigured()) {
      this.logger.warn('SAML SP not fully configured. Auth endpoints will return 503.');
      return;
    }
    try {
      this.metadataStrategy = this.buildStrategy(this.samlConfig.buildSpMetadataSamlConfig());
      this.logger.log('SAML SP metadata strategy initialized');
    } catch (err) {
      this.logger.error('Failed to initialize SAML metadata strategy', err);
    }
  }

  private strategyNameForOrganization(organizationId: number): string {
    return `${SAML_STRATEGY_PREFIX}${organizationId}`;
  }

  private buildStrategy(config: ReturnType<SamlConfigService['buildSamlConfigForOrganization']>): Strategy {
    const samlService = this.samlService;
    return new Strategy(
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
  }

  private registerStrategyForOrganization(orgConfig: OrganizationSamlConfig): Strategy {
    const cached = this.organizationStrategies.get(orgConfig.organizationId);
    if (cached !== undefined) {
      return cached;
    }
    const config = this.samlConfig.buildSamlConfigForOrganization(orgConfig);
    const strategy = this.buildStrategy(config);
    passport.use(this.strategyNameForOrganization(orgConfig.organizationId), strategy as unknown as passport.Strategy);
    this.organizationStrategies.set(orgConfig.organizationId, strategy);
    return strategy;
  }

  private parsePendingOrganizationId(raw: unknown): number | null {
    const parsed = Number.parseInt(String(raw ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  /** IdP ACS is a cross-site POST — RelayState is primary; cookie is a same-site fallback. */
  private resolvePendingOrganizationId(req: Request): number | null {
    const relayState = parseSamlRelayState(req.body?.RelayState ?? req.query?.RelayState);
    if (relayState !== null) {
      return relayState.organizationId;
    }
    return this.parsePendingOrganizationId(req.cookies?.[SAML_PENDING_ORG_COOKIE_NAME]);
  }

  private resolvePendingBrowserId(req: Request): string | null {
    const relayState = parseSamlRelayState(req.body?.RelayState ?? req.query?.RelayState);
    return relayState?.browserId ?? null;
  }

  private normalizeBrowserIdQuery(raw: string | undefined): string | undefined {
    const trimmed = raw?.trim() ?? '';
    if (trimmed === '') {
      return undefined;
    }
    if (!BROWSER_ID_UUID_REGEX.test(trimmed)) {
      throw new BadRequestException('browserId must be a UUID (RFC 4122)');
    }
    return trimmed;
  }

  @Get('status')
  getStatus(): { configured: boolean; entityId?: string } {
    return {
      configured: this.samlConfig.isConfigured(),
      entityId: this.samlConfig.isConfigured() ? this.samlConfig.getSpEntityId() : undefined,
    };
  }

  @Get('organizations')
  async listOrganizations(): Promise<{ organizations: Awaited<ReturnType<SamlOrganizationsService['listOrganizations']>> }> {
    const organizations = await this.samlOrganizationsService.listOrganizations();
    return { organizations };
  }

  @Get('metadata')
  getMetadata(@Res() res: Response): void {
    if (!this.metadataStrategy) {
      res.status(503).json({ error: 'SAML_NOT_CONFIGURED' });
      return;
    }
    const cert = this.samlConfig.getSpCert();
    const rawMetadata = this.metadataStrategy.generateServiceProviderMetadata(cert, cert);
    const metadata = this.transformMetadataForSimpleSaml(rawMetadata);
    res.type('application/xml').send(metadata);
  }

  private transformMetadataForSimpleSaml(xml: string): string {
    let result = xml;
    result = result.replace('<?xml version="1.0"?>', '<?xml version="1.0" encoding="UTF-8"?>');
    result = result.replace(
      'xmlns="urn:oasis:names:tc:SAML:2.0:metadata"',
      'xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"',
    );
    result = result.replace(/ xmlns:ds="http:\/\/www\.w3\.org\/2000\/09\/xmldsig#"/g, '');
    const mdElements = [
      'EntityDescriptor',
      'SPSSODescriptor',
      'KeyDescriptor',
      'SingleLogoutService',
      'NameIDFormat',
      'AssertionConsumerService',
    ];
    for (const el of mdElements) {
      result = result.replace(new RegExp(`<${el}([ >])`, 'g'), `<md:${el}$1`);
      result = result.replace(new RegExp(`<${el}$`, 'gm'), `<md:${el}`);
      result = result.replace(new RegExp(`</${el}>`, 'g'), `</md:${el}>`);
    }
    result = result.replace(
      '<ds:KeyInfo>',
      '<ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
    );
    return result;
  }

  @Get('login')
  async login(
    @Req() req: Request,
    @Res() res: Response,
    @Query('organizationId', new ParseIntPipe({ optional: true })) organizationId?: number,
    @Query('browserId') browserIdRaw?: string,
  ): Promise<void> {
    if (!this.samlConfig.isConfigured()) {
      res.status(503).json({ error: 'SAML_NOT_CONFIGURED' });
      return;
    }
    if (organizationId === undefined || !Number.isFinite(organizationId)) {
      throw new BadRequestException({
        error: 'SAML_ORGANIZATION_REQUIRED',
        message: 'Query parameter organizationId is required before starting SAML login.',
      });
    }
    await this.samlOrganizationsService.assertOrganizationExists(organizationId);
    const orgConfig = await this.samlOrganizationConfigService.loadOrganizationSamlConfig(organizationId);
    this.registerStrategyForOrganization(orgConfig);
    const isProd = process.env.NODE_ENV === 'production';
    const browserId = this.normalizeBrowserIdQuery(browserIdRaw);
    const relayState = formatSamlRelayState(organizationId, browserId);
    Object.assign(req.query, { RelayState: relayState });
    res.cookie(SAML_PENDING_ORG_COOKIE_NAME, String(organizationId), {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: SAML_PENDING_ORG_COOKIE_MAX_AGE_MS,
      path: '/',
    });
    passport.authenticate(this.strategyNameForOrganization(organizationId))(req, res, (err: unknown) => {
      if (err) {
        this.logger.error('SAML login error', err);
        res.status(500).json({ error: 'SAML_LOGIN_ERROR' });
      }
    });
  }

  @Post('acs')
  async handleAcs(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!this.samlConfig.isConfigured()) {
      res.status(503).json({ error: 'SAML_NOT_CONFIGURED' });
      return;
    }
    const pendingOrgId = this.resolvePendingOrganizationId(req);
    if (pendingOrgId === null) {
      res.status(400).json({ error: 'SAML_ORGANIZATION_PENDING_REQUIRED' });
      return;
    }
    const orgConfig = await this.samlOrganizationConfigService.loadOrganizationSamlConfig(pendingOrgId);
    this.registerStrategyForOrganization(orgConfig);
    passport.authenticate(
      this.strategyNameForOrganization(pendingOrgId),
      { session: false },
      (err: unknown, user: unknown) => {
        void this.finalizeAcs(req, res, err, user, pendingOrgId);
      },
    )(req, res);
  }

  private async finalizeAcs(
    req: Request,
    res: Response,
    err: unknown,
    user: unknown,
    organizationId: number,
  ): Promise<void> {
    if (err) {
      this.logger.error('ACS error', err);
      res.status(401).json({ error: 'SAML_AUTH_FAILED' });
      return;
    }
    if (!user) {
      res.status(401).json({ error: 'SAML_NO_USER' });
      return;
    }
    const samlUser = user as SamlUser;
    let userId: number;
    try {
      userId = await this.samlAccountProvisioningService.provisionFromSamlSession(
        {
          sub: samlUser.nameId,
          nameIdFormat: samlUser.nameIdFormat,
          sessionIndex: samlUser.sessionIndex,
          email: samlUser.email,
          givenName: samlUser.givenName,
          surname: samlUser.surname,
          displayName: samlUser.displayName,
          affiliations: samlUser.affiliations,
          role: samlUser.role,
          organizationId,
        },
        organizationId,
      );
    } catch (provisionErr) {
      const message = provisionErr instanceof Error ? provisionErr.message : String(provisionErr);
      this.logger.error(`SAML account provisioning failed: ${message}`);
      res.status(500).json({ error: 'SAML_PROVISIONING_FAILED' });
      return;
    }
    const token = this.samlService.signSessionToken(samlUser, organizationId, userId);
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(SAML_PENDING_ORG_COOKIE_NAME, isProd ? { path: '/', secure: true } : { path: '/' });
    res.cookie(SAML_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: jwtExpiresInToCookieMaxAgeMs(this.samlConfig.getJwtExpiresIn()),
      path: '/',
    });
    const pendingBrowserId = this.resolvePendingBrowserId(req);
    if (pendingBrowserId !== null) {
      const sessionPayload = this.samlService.verifySessionToken(token);
      if (sessionPayload !== null) {
        await this.loginApiService.mintAuthCookieFromSamlPayload(res, sessionPayload, pendingBrowserId);
      }
    }
    res.redirect(this.samlConfig.getLoginSuccessUrl());
  }

  @Get('me')
  getMe(@Req() req: Request): { authenticated: boolean; user?: unknown } {
    const token = req.cookies?.[SAML_SESSION_COOKIE_NAME];
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
  logout(@Res() res: Response): void {
    this.clearBrowserAuthCookies(res);
    res.json({ success: true });
  }

  @Get('logout')
  async samlLogout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const token = req.cookies?.[SAML_SESSION_COOKIE_NAME];
    const session = token ? this.samlService.verifySessionToken(token) : null;
    this.clearBrowserAuthCookies(res);
    if (!this.samlConfig.isConfigured() || session?.organizationId === undefined) {
      res.redirect(this.samlConfig.getLogoutUrl());
      return;
    }
    if (!session.sub) {
      res.redirect(this.samlConfig.getLogoutUrl());
      return;
    }
    let orgConfig: OrganizationSamlConfig;
    try {
      orgConfig = await this.samlOrganizationConfigService.loadOrganizationSamlConfig(session.organizationId);
    } catch {
      res.redirect(this.samlConfig.getLogoutUrl());
      return;
    }
    if (!orgConfig.logoutUrl) {
      res.redirect(this.samlConfig.getLogoutUrl());
      return;
    }
    const strategy = this.registerStrategyForOrganization(orgConfig);
    const samlUser = {
      nameID: session.sub,
      nameIDFormat: session.nameIdFormat || 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
      sessionIndex: session.sessionIndex,
    };
    (req as unknown as { user: typeof samlUser }).user = samlUser;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (strategy.logout as any)(req, (err: Error | null, logoutUrl?: string | null) => {
      if (err || !logoutUrl) {
        res.redirect(this.samlConfig.getLogoutUrl());
        return;
      }
      res.redirect(logoutUrl);
    });
  }

  @Get('slo')
  handleSloGet(@Req() req: Request, @Res() res: Response): void {
    this.handleSloCallback(req, res);
  }

  @Post('slo')
  handleSloPost(@Req() req: Request, @Res() res: Response): void {
    this.handleSloCallback(req, res);
  }

  private handleSloCallback(_req: Request, res: Response): void {
    this.clearBrowserAuthCookies(res);
    res.redirect(this.samlConfig.getLogoutUrl());
  }

  private clearBrowserAuthCookies(res: Response): void {
    const isProd = process.env.NODE_ENV === 'production';
    const cookieOptions = isProd ? { path: '/', secure: true } : { path: '/' };
    res.clearCookie(SAML_SESSION_COOKIE_NAME, cookieOptions);
    res.clearCookie(MAQ_AUTH_COOKIE_NAME, cookieOptions);
    res.clearCookie(SAML_PENDING_ORG_COOKIE_NAME, cookieOptions);
  }
}
