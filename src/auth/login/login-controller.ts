import { Controller, Headers, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { MAQ_AUTH_COOKIE_NAME } from '../../constants/api-token-constants';
import { SAML_SESSION_COOKIE_NAME } from '../../constants/saml-constants';
import { LoginApiService } from './login-api.service';

/**
 * Issues opaque API bearer secrets after SAML browser sessions.
 */
@Controller('login')
export class LoginController {
  constructor(private readonly loginApiService: LoginApiService) {}

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

  /**
   * Clears all auth-related cookies (logout for browser clients).
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    res.clearCookie(MAQ_AUTH_COOKIE_NAME, { path: '/' });
    res.clearCookie(SAML_SESSION_COOKIE_NAME, { path: '/' });
    return { success: true };
  }
}
