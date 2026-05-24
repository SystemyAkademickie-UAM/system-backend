import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { IsOptional, IsString } from 'class-validator';

import { SAML_SESSION_COOKIE_NAME } from '../../constants/saml-constants';
import { jwtExpiresInToCookieMaxAgeMs } from '../saml/saml-jwt-expiry.util';
import { SamlConfigService } from '../saml/saml-config.service';
import { SamlService } from '../saml/saml.service';
import type { SamlUser } from '../saml/saml.types';
import { SamlBypassService } from './saml-bypass.service';

class SamlBypassSessionBodyDto {
  @IsOptional()
  @IsString()
  persona?: string;

  /** @deprecated Use `persona`. */
  @IsOptional()
  @IsString()
  profile?: string;
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

  @Get('bypass/status')
  getBypassStatus(): {
    enabled: boolean;
    personas: ReturnType<SamlBypassService['listPersonas']>;
  } {
    if (!this.bypassService.isBypassAllowed()) {
      return { enabled: false, personas: [] };
    }
    return {
      enabled: true,
      personas: this.bypassService.listPersonas(),
    };
  }

  @Get('bypass/student')
  async getBypassStudent(@Res() res: Response): Promise<void> {
    this.bypassService.assertBypassAllowed();
    const sessionUser = await this.bypassService.seedDevPersona('student1');
    this.attachSessionCookie(res, sessionUser);
    res.redirect(this.samlConfigService.getLoginSuccessUrl());
  }

  @Get('bypass/lecturer')
  async getBypassLecturer(@Res() res: Response): Promise<void> {
    this.bypassService.assertBypassAllowed();
    const sessionUser = await this.bypassService.seedDevPersona('lecturer1');
    this.attachSessionCookie(res, sessionUser);
    res.redirect(this.samlConfigService.getLoginSuccessUrl());
  }

  @Post('bypass/session')
  @HttpCode(HttpStatus.OK)
  async postBypassSession(
    @Body() body: SamlBypassSessionBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true; persona: string }> {
    this.bypassService.assertBypassAllowed();
    const rawPersona = body.persona?.trim() ?? '';
    const rawProfile = body.profile?.trim() ?? '';
    const candidate = rawPersona !== '' ? rawPersona : rawProfile;
    if (candidate === '') {
      throw new BadRequestException({
        error: 'SAML_BYPASS_PERSONA_REQUIRED',
        message: 'Request body must include `persona` (dev bypass id).',
      });
    }
    const personaId = this.bypassService.resolvePersonaId(candidate);
    const sessionUser = await this.bypassService.seedDevPersona(personaId);
    this.attachSessionCookie(res, sessionUser);
    return { ok: true, persona: personaId };
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
      path: '/',
    });
  }
}
