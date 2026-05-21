import { Controller, Headers, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

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
}
