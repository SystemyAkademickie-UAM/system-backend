import { Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { LoginApiService } from './login-api.service';

/**
 * Clears API auth cookies (`maq_auth`, SAML session) and revokes the token row.
 */
@Controller()
export class LogoutController {
  constructor(private readonly loginApiService: LoginApiService) {}

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    return this.loginApiService.clearAuthCookiesAndRevokeToken(req, res);
  }
}
