import { Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { LoginApiService } from './login-api.service';

/**
 * Clears API auth cookies (`maq_auth`, SAML session).
 */
@Controller()
export class LogoutController {
  constructor(private readonly loginApiService: LoginApiService) {}

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { success: true } {
    return this.loginApiService.clearAuthCookies(res);
  }
}
