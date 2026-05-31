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
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { AuthTokenSessionService } from '../api-token/auth-token-session-service';
import { RegistrationService } from '../../registration/registration.service';
import { LoginApiService } from './login-api.service';

interface UpdateProfileDto {
  nickname: string;
  avatarId: number;
}

/**
 * Login flow: opaque token exchange and in-wizard registration steps.
 */
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
  async mintOpaqueToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-browser-id') browserId: string | undefined,
  ): Promise<{ auth: string }> {
    return this.loginApiService.exchangeSamlSessionForOpaqueBearerToken(req, res, browserId);
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
  ) {
    return this.loginApiService.resolveAuthenticatedUserFromApiToken(req, browserId);
  }

  @Get('registration-status')
  @HttpCode(HttpStatus.OK)
  async getRegistrationStatus(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
  ) {
    let subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
      req,
      browserId,
      undefined,
    );
    if (!subject) {
      subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, undefined);
    }
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
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
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
    const subject = await this.authTokenSessionService.resolveSubjectStrongFromRequest(
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
