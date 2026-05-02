import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';

import { SamlConfigService } from './saml-config.service';
import type { SamlSessionUser } from './saml.types';

export type SamlSessionJwtPayload = {
  sub: string;
  email?: string;
  displayName?: string;
  /** SAML NameIDFormat — stored for single logout. */
  nameIDFormat?: string;
  sessionIndex?: string;
  nameQualifier?: string;
  spNameQualifier?: string;
  /** IdP entity ID from SAML assertion issuer. */
  idpIssuer?: string;
};

@Injectable()
export class SamlAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly samlConfig: SamlConfigService,
  ) {}

  signSessionToken(user: SamlSessionUser): string {
    const payload: SamlSessionJwtPayload = {
      sub: user.nameId,
      email: user.email,
      displayName: user.displayName,
      nameIDFormat: user.nameIDFormat,
      sessionIndex: user.sessionIndex,
      nameQualifier: user.nameQualifier,
      spNameQualifier: user.spNameQualifier,
      idpIssuer: user.idpIssuer,
    };
    const expiresIn = this.samlConfig.getSessionJwtExpiresIn() as SignOptions['expiresIn'];
    return this.jwtService.sign(payload, { expiresIn });
  }

  decodeSessionTokenOrNull(token: string): SamlSessionJwtPayload | null {
    try {
      return this.jwtService.verify<SamlSessionJwtPayload>(token);
    } catch {
      return null;
    }
  }
}
