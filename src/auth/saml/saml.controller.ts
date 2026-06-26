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
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard, seconds } from '@nestjs/throttler';
import { Strategy, type VerifiedCallback } from '@node-saml/passport-saml';
import type { Profile } from '@node-saml/node-saml';
import type { Request, Response } from 'express';
import passport from 'passport';
import type { AuthenticateOptions } from '@node-saml/passport-saml/lib/types';

import {
  LEGACY_MAQ_AUTH_COOKIE_NAME,
  LEGACY_MAQ_ACTIVE_ROLE_COOKIE_NAME,
  MAQ_SESSION_COOKIE_NAME,
} from '../../constants/session-constants';
import {
  MAQ_LOGOUT_RETURN_COOKIE_MAX_AGE_MS,
  MAQ_LOGOUT_RETURN_COOKIE_NAME,
  SAML_PENDING_ORG_COOKIE_MAX_AGE_MS,
  SAML_PENDING_ORG_COOKIE_NAME,
  SAML_SESSION_COOKIE_NAME,
} from '../../constants/saml-constants';
import { SessionService } from '../session/session.service';
import {
  AUTH_THROTTLE_TTL_SECONDS,
  SAML_LOGIN_THROTTLE_LIMIT,
} from '../../constants/throttler-constants';
import { LoginApiService } from '../login/login-api.service';
import { SamlAccountProvisioningService } from './saml-account-provisioning.service';
import { SamlConfigService } from './saml-config.service';
import {
  SamlOrganizationConfigService,
  type OrganizationSamlConfig,
} from './saml-organization-config.service';
import {
  ORGANIZATION_LOGIN_METHOD_SAML,
} from '../../constants/organization-constants';
import { OrganizationLoginService } from '../organization-login/organization-login.service';
import { SamlService } from './saml.service';
import type { SamlUser } from './saml.types';
import {
  buildClearSamlCookieOptions,
  buildPendingOrgCookieOptions,
  buildSamlSessionCookieOptions,
  resolvePendingOrgCookieSameSite,
} from './saml-cookie-options.util';
import { parseSamlRelayState, type ParsedSamlRelayState } from './saml-relay-state.util';
import { SamlRelayStateTokenService } from './saml-relay-state-token.service';

const SAML_STRATEGY_PREFIX = 'saml-org-';

@ApiTags('SAML')
@Controller('auth/saml')
export class SamlController {
  private readonly logger = new Logger(SamlController.name);
  private metadataStrategy: Strategy | null = null;
  private readonly organizationStrategies = new Map<number, Strategy>();

  constructor(
    private readonly samlConfig: SamlConfigService,
    private readonly samlService: SamlService,
    private readonly organizationLoginService: OrganizationLoginService,
    private readonly samlOrganizationConfigService: SamlOrganizationConfigService,
    private readonly samlAccountProvisioningService: SamlAccountProvisioningService,
    @Inject(forwardRef(() => LoginApiService))
    private readonly loginApiService: LoginApiService,
    private readonly samlRelayStateTokenService: SamlRelayStateTokenService,
    private readonly sessionService: SessionService) {
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
      });
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

  private readRelayStateRaw(req: Request): unknown {
    const raw = req.body?.RelayState ?? req.query?.RelayState;
    if (typeof raw !== 'string') {
      return raw;
    }
    const trimmed = raw.trim();
    if (trimmed === '') {
      return raw;
    }
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }

  /** IdP ACS is a cross-site POST — RelayState store, legacy RelayState, then pending-org cookie. */
  private resolvePendingLoginContext(req: Request): ParsedSamlRelayState | null {
    const rawRelayState = this.readRelayStateRaw(req);
    const legacyRelayState = parseSamlRelayState(rawRelayState);
    if (legacyRelayState !== null) {
      return legacyRelayState;
    }
    const storedContext = this.samlRelayStateTokenService.parseRelayStateToken(rawRelayState);
    if (storedContext !== null) {
      return {
        organizationId: storedContext.organizationId,
        browserId: storedContext.browserId,
      };
    }
    const cookieOrganizationId = this.parsePendingOrganizationId(req.cookies?.[SAML_PENDING_ORG_COOKIE_NAME]);
    if (cookieOrganizationId === null) {
      return null;
    }
    return { organizationId: cookieOrganizationId, browserId: null };
  }


  @Get('status')
  @ApiOperation({ summary: 'Get SAML SP configuration status' })
  getStatus(): { configured: boolean; entityId?: string } {
    return {
      configured: this.samlConfig.isConfigured(),
      entityId: this.samlConfig.isConfigured() ? this.samlConfig.getSpEntityId() : undefined,
    };
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List organizations with SAML enabled' })
  async listOrganizations(): Promise<{ organizations: Awaited<ReturnType<OrganizationLoginService['listOrganizations']>> }> {
    const organizations = await this.organizationLoginService.listOrganizations(ORGANIZATION_LOGIN_METHOD_SAML);
    return { organizations };
  }

  @Get('metadata')
  @ApiOperation({ summary: 'Get SP metadata XML' })
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
      'xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"');
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
      '<ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">');
    return result;
  }

  @Get('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: SAML_LOGIN_THROTTLE_LIMIT, ttl: seconds(AUTH_THROTTLE_TTL_SECONDS) } })
  @ApiOperation({ summary: 'Start SAML login for an organization' })
  async login(
    @Req() req: Request,
    @Res() res: Response,
    @Query('organizationId', new ParseIntPipe({ optional: true })) organizationId?: number): Promise<void> {
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
    await this.organizationLoginService.assertOrganizationLoginMethod(
      organizationId,
      ORGANIZATION_LOGIN_METHOD_SAML,
    );
    const orgConfig = await this.samlOrganizationConfigService.loadOrganizationSamlConfig(organizationId);
    this.registerStrategyForOrganization(orgConfig);
    const relayState = this.samlRelayStateTokenService.createRelayStateToken(organizationId, null);
    res.cookie(
      SAML_PENDING_ORG_COOKIE_NAME,
      String(organizationId),
      buildPendingOrgCookieOptions(req, SAML_PENDING_ORG_COOKIE_MAX_AGE_MS));
    const samlLoginOptions: AuthenticateOptions = {
      additionalParams: { RelayState: relayState },
    };
    passport.authenticate(this.strategyNameForOrganization(organizationId), samlLoginOptions)(req, res, (err: unknown) => {
      if (err) {
        this.logger.error('SAML login error', err);
        res.status(500).json({ error: 'SAML_LOGIN_ERROR' });
      }
    });
  }

  @Post('acs')
  @ApiOperation({ summary: 'Handle SAML assertion consumer service callback' })
  async handleAcs(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!this.samlConfig.isConfigured()) {
      res.status(503).json({ error: 'SAML_NOT_CONFIGURED' });
      return;
    }
    const pendingLoginContext = this.resolvePendingLoginContext(req);
    if (pendingLoginContext === null) {
      const relayStateHint = String(this.readRelayStateRaw(req) ?? '');
      this.logger.warn(
        `ACS missing organization context (RelayState=${relayStateHint.length > 0 ? relayStateHint : '<empty>'}, pendingOrgCookie=${String(req.cookies?.[SAML_PENDING_ORG_COOKIE_NAME] ?? '<missing>')})`);
      res.status(400).json({ error: 'SAML_ORGANIZATION_PENDING_REQUIRED' });
      return;
    }
    const pendingOrgId = pendingLoginContext.organizationId;
    const orgConfig = await this.samlOrganizationConfigService.loadOrganizationSamlConfig(pendingOrgId);
    this.registerStrategyForOrganization(orgConfig);
    passport.authenticate(
      this.strategyNameForOrganization(pendingOrgId),
      { session: false },
      (err: unknown, user: unknown) => {
        void this.finalizeAcs(req, res, err, user, pendingOrgId);
      })(req, res);
  }

  private async finalizeAcs(
    req: Request,
    res: Response,
    err: unknown,
    user: unknown,
    organizationId: number): Promise<void> {
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
        organizationId);
    } catch (provisionErr) {
      const message = provisionErr instanceof Error ? provisionErr.message : String(provisionErr);
      this.logger.error(`SAML account provisioning failed: ${message}`);
      res.status(500).json({ error: 'SAML_PROVISIONING_FAILED' });
      return;
    }
    const pendingOrgClearOptions = buildClearSamlCookieOptions(req, resolvePendingOrgCookieSameSite(req));
    res.clearCookie(SAML_PENDING_ORG_COOKIE_NAME, pendingOrgClearOptions);
    await this.loginApiService.establishSession(req, res, {
      userId,
      loginMethod: 'saml',
      organizationId,
      samlNameId: samlUser.nameId,
      samlNameIdFormat: samlUser.nameIdFormat,
      samlSessionIndex: samlUser.sessionIndex,
    });
    res.redirect(this.samlConfig.getLoginSuccessUrl());
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current SAML session user (deprecated - use /login/me)' })
  async getMe(@Req() req: Request): Promise<{ authenticated: boolean; user?: unknown }> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, undefined);
    if (!subject) {
      return { authenticated: false };
    }
    return { authenticated: true, user: { userId: subject.userId } };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Clear browser auth cookies' })
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.clearBrowserAuthCookiesAndRevokeSession(req, res);
    res.json({ success: true });
  }

  @Get('logout')
  @ApiOperation({ summary: 'Initiate SAML single logout' })
  async samlLogout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const postLogoutRedirect = this.samlConfig.resolvePostLogoutRedirect(req.query.postLogoutRedirect);
    res.cookie(
      MAQ_LOGOUT_RETURN_COOKIE_NAME,
      postLogoutRedirect,
      buildPendingOrgCookieOptions(req, MAQ_LOGOUT_RETURN_COOKIE_MAX_AGE_MS));
    const token = this.sessionService.extractSessionToken(req);
    const sessionRow = token ? await this.sessionService.getSessionRow(token) : null;
    await this.clearBrowserAuthCookiesAndRevokeSession(req, res);
    if (!this.samlConfig.isConfigured() || sessionRow?.organizationId == null) {
      res.redirect(postLogoutRedirect);
      return;
    }
    if (!sessionRow.samlNameId) {
      res.redirect(postLogoutRedirect);
      return;
    }
    const organizationId = sessionRow.organizationId;
    let orgConfig: OrganizationSamlConfig;
    try {
      orgConfig = await this.samlOrganizationConfigService.loadOrganizationSamlConfig(organizationId);
    } catch {
      res.redirect(postLogoutRedirect);
      return;
    }
    if (!orgConfig.logoutUrl) {
      res.redirect(postLogoutRedirect);
      return;
    }
    const strategy = this.registerStrategyForOrganization(orgConfig);
    const samlUser = {
      nameID: sessionRow.samlNameId,
      nameIDFormat: sessionRow.samlNameIdFormat || 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
      sessionIndex: sessionRow.samlSessionIndex,
    };
    (req as unknown as { user: typeof samlUser }).user = samlUser;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (strategy.logout as any)(req, (err: Error | null, logoutUrl?: string | null) => {
      if (err || !logoutUrl) {
        res.redirect(postLogoutRedirect);
        return;
      }
      res.redirect(logoutUrl);
    });
  }

  @Get('slo')
  @ApiOperation({ summary: 'Handle SAML single logout callback (GET)' })
  async handleSloGet(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handleSloCallback(req, res);
  }

  @Post('slo')
  @ApiOperation({ summary: 'Handle SAML single logout callback (POST)' })
  async handleSloPost(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handleSloCallback(req, res);
  }

  private async handleSloCallback(req: Request, res: Response): Promise<void> {
    const storedRedirect = req.cookies?.[MAQ_LOGOUT_RETURN_COOKIE_NAME];
    const postLogoutRedirect =
      typeof storedRedirect === 'string' && storedRedirect.startsWith('http')
        ? storedRedirect
        : this.samlConfig.getLogoutUrl();
    const logoutReturnClearOptions = buildClearSamlCookieOptions(req, resolvePendingOrgCookieSameSite(req));
    res.clearCookie(MAQ_LOGOUT_RETURN_COOKIE_NAME, logoutReturnClearOptions);
    await this.clearBrowserAuthCookiesAndRevokeSession(req, res);
    res.redirect(postLogoutRedirect);
  }

  private async clearBrowserAuthCookiesAndRevokeSession(req: Request, res: Response): Promise<void> {
    await this.loginApiService.clearAuthCookiesAndRevokeSession(req, res);
    const sessionClearOptions = buildClearSamlCookieOptions(req, 'lax');
    const pendingOrgClearOptions = buildClearSamlCookieOptions(req, resolvePendingOrgCookieSameSite(req));
    res.clearCookie(SAML_SESSION_COOKIE_NAME, sessionClearOptions);
    res.clearCookie(LEGACY_MAQ_AUTH_COOKIE_NAME, sessionClearOptions);
    res.clearCookie(LEGACY_MAQ_ACTIVE_ROLE_COOKIE_NAME, sessionClearOptions);
    res.clearCookie(MAQ_SESSION_COOKIE_NAME, sessionClearOptions);
    res.clearCookie(SAML_PENDING_ORG_COOKIE_NAME, pendingOrgClearOptions);
  }
}
