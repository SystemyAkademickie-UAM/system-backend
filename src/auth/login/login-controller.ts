import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard, seconds } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { MAQ_SESSION_COOKIE_NAME } from '../../constants/session-constants';
import { SessionService } from '../session/session.service';
import { RegistrationService } from '../../registration/registration.service';
import {
  ACTIVE_ROLE_THROTTLE_LIMIT,
  AUTH_THROTTLE_TTL_SECONDS,
  LOGIN_THROTTLE_LIMIT,
  MAGIC_LINK_REQUEST_THROTTLE_LIMIT,
} from '../../constants/throttler-constants';
import { LoginApiService } from './login-api.service';
import { SelectActiveRoleDto } from './dto/select-active-role.dto';
import { RequestMagicLinkDto } from '../magic-link/dto/request-magic-link.dto';
import { VerifyMagicLinkDto } from '../magic-link/dto/verify-magic-link.dto';
import { MagicLinkService } from '../magic-link/magic-link.service';
import {
  OrganizationLoginService,
  type PublicOrganizationLoginMethod,
} from '../organization-login/organization-login.service';
import {
  ORGANIZATION_LOGIN_METHOD_EMAIL,
  ORGANIZATION_LOGIN_METHOD_SAML,
} from '../../constants/organization-constants';

interface UpdateProfileDto {
  nickname: string;
  avatarId: number;
}

/**
 * Login flow: session introspection and in-wizard registration steps.
 * SAML exchange (POST /login) removed — SAML ACS establishes session directly.
 */
@ApiTags('Login')
@Controller('login')
export class LoginController {
  constructor(
    private readonly loginApiService: LoginApiService,
    private readonly sessionService: SessionService,
    private readonly registrationService: RegistrationService,
    private readonly magicLinkService: MagicLinkService,
    private readonly organizationLoginService: OrganizationLoginService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve current user from session cookie' })
  @ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
  @ApiOkResponse({
    description: 'Authenticated user profile summary',
    schema: {
      type: 'object',
      properties: {
        authenticated: { type: 'boolean', example: true },
        user: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
    },
  })
  async getMe(@Req() req: Request) {
    return this.loginApiService.resolveAuthenticatedUser(req);
  }

  @Post('active-role')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: ACTIVE_ROLE_THROTTLE_LIMIT, ttl: seconds(AUTH_THROTTLE_TTL_SECONDS) } })
  @ApiOperation({ summary: 'Select the active role from roles the user holds' })
  @ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
  @ApiOkResponse({ description: 'Updated session view with the new active role' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session' })
  @ApiBadRequestResponse({ description: 'Requested role is not assigned to the user' })
  async setActiveRole(
    @Req() req: Request,
    @Body() body: SelectActiveRoleDto) {
    return this.loginApiService.setActiveRole(req, body.role);
  }

  @Get('registration-status')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
  async getRegistrationStatus(@Req() req: Request) {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, undefined);
    if (!subject) {
      throw new ForbiddenException('Not authenticated');
    }
    return this.registrationService.getRegistrationStatus(subject.userId);
  }

  @Post('profile')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
  async updateProfile(
    @Req() req: Request,
    @Body() body: UpdateProfileDto) {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, undefined);
    if (!subject) {
      throw new ForbiddenException('Not authenticated');
    }
    return this.registrationService.updateProfile(
      subject.userId,
      body.nickname,
      body.avatarId);
  }

  @Post('accept-eula')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(MAQ_SESSION_COOKIE_NAME)
  async acceptEula(@Req() req: Request) {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, undefined);
    if (!subject) {
      throw new ForbiddenException('Not authenticated');
    }
    return this.registrationService.acceptEula(subject.userId);
  }

  /**
   * Lists client organizations for login pickers (`auth.organizations.login_method`).
   */
  @Get('organizations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List organizations by login method (saml or email)' })
  async listOrganizations(@Query('loginMethod') loginMethodRaw?: string) {
    const loginMethod = this.parsePublicLoginMethod(loginMethodRaw);
    const organizations = await this.organizationLoginService.listOrganizations(loginMethod);
    return { organizations };
  }

  private parsePublicLoginMethod(raw: string | undefined): PublicOrganizationLoginMethod {
    const loginMethod = raw?.trim();
    if (loginMethod === ORGANIZATION_LOGIN_METHOD_SAML || loginMethod === ORGANIZATION_LOGIN_METHOD_EMAIL) {
      return loginMethod;
    }
    throw new BadRequestException({
      error: 'INVALID_LOGIN_METHOD',
      message: 'Query param loginMethod must be saml or email.',
    });
  }

  /**
   * Sends a one-time login link; organization is resolved from the provisioned account.
   */
  @Post('magic-link/request')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({
    default: { limit: MAGIC_LINK_REQUEST_THROTTLE_LIMIT, ttl: seconds(AUTH_THROTTLE_TTL_SECONDS) },
  })
  @ApiOperation({ summary: 'Request email magic link for passwordless login' })
  async requestMagicLink(@Body() body: RequestMagicLinkDto) {
    return this.magicLinkService.requestMagicLink(body.email);
  }

  /**
   * Consumes a magic link token and establishes a session.
   */
  @Post('magic-link/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: LOGIN_THROTTLE_LIMIT, ttl: seconds(AUTH_THROTTLE_TTL_SECONDS) } })
  @ApiOperation({ summary: 'Verify email magic link and start session' })
  async verifyMagicLink(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: VerifyMagicLinkDto): Promise<{ session: string }> {
    return this.magicLinkService.verifyMagicLink(req, res, body.token);
  }
}
