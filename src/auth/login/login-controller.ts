import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard, seconds } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { MAQ_AUTH_COOKIE_NAME } from '../../constants/api-token-constants';
import { SAML_SESSION_COOKIE_NAME } from '../../constants/saml-constants';

import { AuthTokenSessionService } from '../api-token/auth-token-session-service';
import { RegistrationService } from '../../registration/registration.service';
import {
  ACTIVE_ROLE_THROTTLE_LIMIT,
  AUTH_THROTTLE_TTL_SECONDS,
  LOGIN_THROTTLE_LIMIT,
} from '../../constants/throttler-constants';
import { LoginApiService } from './login-api.service';
import { SelectActiveRoleDto } from './dto/select-active-role.dto';

interface UpdateProfileDto {
  nickname: string;
  avatarId: number;
}

/**
 * Login flow: opaque token exchange and in-wizard registration steps.
 */
@ApiTags('Login')
@Controller('login')
export class LoginController {
  constructor(
    private readonly loginApiService: LoginApiService,
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly registrationService: RegistrationService,
  ) {}

  /**
   * Exchanges HTTP-only SSO cookie (`saml_session`) for an auth token.
   * Sets `maq_auth` HTTP-only cookie for browser clients AND returns `{ "auth": "..." }` for API clients.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: LOGIN_THROTTLE_LIMIT, ttl: seconds(AUTH_THROTTLE_TTL_SECONDS) } })
  @ApiOperation({ summary: 'Exchange SAML session cookie for opaque API token' })
  @ApiCookieAuth(SAML_SESSION_COOKIE_NAME)
  @ApiHeader({
    name: 'X-Browser-ID',
    required: true,
    description: 'RFC 4122 UUID for token binding',
  })
  @ApiOkResponse({
    description: 'Opaque bearer token (also set as HTTP-only cookie)',
    schema: {
      type: 'object',
      properties: { auth: { type: 'string', example: 'opaque-token-value' } },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid SAML session cookie' })
  async mintOpaqueToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-browser-id') browserId: string | undefined,
  ): Promise<{ auth: string }> {
    return this.loginApiService.exchangeSamlSessionForOpaqueBearerToken(req, res, browserId);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve current user from API token session' })
  @ApiCookieAuth(MAQ_AUTH_COOKIE_NAME)
  @ApiHeader({
    name: 'X-Browser-ID',
    required: true,
    description: 'RFC 4122 UUID bound to the token row',
  })
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
  async getMe(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
  ) {
    return this.loginApiService.resolveAuthenticatedUserFromApiToken(req, browserId);
  }

  @Post('active-role')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: ACTIVE_ROLE_THROTTLE_LIMIT, ttl: seconds(AUTH_THROTTLE_TTL_SECONDS) } })
  @ApiOperation({ summary: 'Select the active role from roles the user holds' })
  @ApiCookieAuth(MAQ_AUTH_COOKIE_NAME)
  @ApiHeader({
    name: 'X-Browser-ID',
    required: true,
    description: 'RFC 4122 UUID bound to the token row',
  })
  @ApiOkResponse({ description: 'Updated session view with the new active role' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid session' })
  @ApiBadRequestResponse({ description: 'Requested role is not assigned to the user' })
  async setActiveRole(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: SelectActiveRoleDto,
  ) {
    return this.loginApiService.setActiveRole(req, res, browserId, body.role);
  }

  @Get('registration-status')
  @HttpCode(HttpStatus.OK)
  async getRegistrationStatus(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
  ) {
    const subject = await this.authTokenSessionService.resolveSubjectStrongOrSoftFromRequest(
      req,
      browserId,
      undefined,
    );
    if (!subject) {
      throw new ForbiddenException('Not authenticated');
    }
    return this.registrationService.getRegistrationStatus(subject.userId);
  }

  @Post('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: UpdateProfileDto,
  ) {
    const subject = await this.authTokenSessionService.resolveSubjectStrongOrSoftFromRequest(
      req,
      browserId,
      undefined,
    );
    if (!subject) {
      throw new ForbiddenException('Not authenticated');
    }
    return this.registrationService.updateProfile(
      subject.userId,
      body.nickname,
      body.avatarId,
    );
  }

  @Post('accept-eula')
  @HttpCode(HttpStatus.OK)
  async acceptEula(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
  ) {
    const subject = await this.authTokenSessionService.resolveSubjectStrongOrSoftFromRequest(
      req,
      browserId,
      undefined,
    );
    if (!subject) {
      throw new ForbiddenException('Not authenticated');
    }
    return this.registrationService.acceptEula(subject.userId);
  }
}
