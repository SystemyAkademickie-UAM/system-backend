import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { LoginApiService } from './login-api.service';

/**
 * Issues opaque API bearer secrets after SAML browser sessions.
 */
@Controller('login')
export class LoginController {
  constructor(private readonly loginApiService: LoginApiService) {}

  /**
   * Exchanges HTTP-only SSO cookie (`maqSamlSession`) for `{ "auth": "<plaintext_opaque_token>" }` using `X-Browser-ID`.
   *
   * @remarks A JSON body is reserved for future email/password provisioning and remains unused for now — clients may omit the body entirely.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  mintOpaqueToken(
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
  ): Promise<{ auth: string }> {
    return this.loginApiService.exchangeSamlSessionForOpaqueBearerToken(req, browserId);
  }
}
