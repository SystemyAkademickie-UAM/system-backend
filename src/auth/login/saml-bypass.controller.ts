import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { IsIn, IsString } from 'class-validator';

import { SAML_SESSION_COOKIE_NAME } from '../../constants/saml-constants';
import { jwtExpiresInToCookieMaxAgeMs } from '../saml/saml-jwt-expiry.util';
import { SamlConfigService } from '../saml/saml-config.service';
import { SamlService } from '../saml/saml.service';
import type { SamlUser } from '../saml/saml.types';
import { SamlBypassService } from './saml-bypass.service';

class SamlBypassSessionBodyDto {
  @IsString()
  @IsIn(['student', 'lecturer'])
  profile: 'student' | 'lecturer';
}

/**
 * Dev-only endpoints mirroring SAML ACS: mint `maqSamlSession` without an IdP (`SAML_BYPASS_ENABLED`).
 */
@Controller('auth/saml')
export class SamlBypassController {
  constructor(
    private readonly bypassService: SamlBypassService,
    private readonly samlService: SamlService,
    private readonly samlConfigService: SamlConfigService,
  ) {}

  @Get('bypass/student')
  async getBypassStudent(@Res() res: Response): Promise<void> {
    this.bypassService.assertBypassAllowed();
    const sessionUser = await this.bypassService.seedDevPersona('student');
    this.attachSessionCookie(res, sessionUser);
    res.redirect(this.samlConfigService.getLoginSuccessUrl());
  }

  @Get('bypass/lecturer')
  async getBypassLecturer(@Res() res: Response): Promise<void> {
    this.bypassService.assertBypassAllowed();
    const sessionUser = await this.bypassService.seedDevPersona('lecturer');
    this.attachSessionCookie(res, sessionUser);
    res.redirect(this.samlConfigService.getLoginSuccessUrl());
  }

  @Post('bypass/session')
  @HttpCode(HttpStatus.OK)
  async postBypassSession(
    @Body() body: SamlBypassSessionBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true; profile: 'student' | 'lecturer' }> {
    this.bypassService.assertBypassAllowed();
    const profile = body.profile;
    const sessionUser = await this.bypassService.seedDevPersona(profile);
    this.attachSessionCookie(res, sessionUser);
    return { ok: true, profile };
  }

  private attachSessionCookie(res: Response, sessionUser: SamlUser): void {
    const token = this.samlService.signSessionToken(sessionUser);
    const isProd = process.env.NODE_ENV === 'production';
    const sessionTtlMs = jwtExpiresInToCookieMaxAgeMs(this.samlConfigService.getJwtExpiresIn());
    res.cookie(SAML_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: sessionTtlMs,
    });
  }
}
