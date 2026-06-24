import { Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { LoginApiService } from './login-api.service';

/**
 * Clears session cookie and revokes the session row.
 */
@ApiTags('Login')
@Controller()
export class LogoutController {
  constructor(private readonly loginApiService: LoginApiService) {}

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear session cookie and revoke the session row' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response): Promise<{ success: true }> {
    return this.loginApiService.clearAuthCookiesAndRevokeSession(req, res);
  }
}
