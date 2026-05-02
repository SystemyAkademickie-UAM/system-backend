import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { SamlConfigService } from './saml-config.service';
import { SamlAuthService } from './saml-auth.service';
import type { SamlSessionUser } from './saml.types';

describe('SamlAuthService', () => {
  let service: SamlAuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SamlAuthService,
        {
          provide: SamlConfigService,
          useValue: {
            getSessionJwtExpiresIn: jest.fn().mockReturnValue('8h'),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed.jwt.token'),
            verify: jest.fn().mockReturnValue({ sub: 'urn:test', email: 'a@b.pl' }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(SamlAuthService);
    jwtService = moduleRef.get(JwtService);
  });

  it('signSessionToken delegates to JwtService.sign with payload and expiresIn', () => {
    const user: SamlSessionUser = {
      nameId: 'urn:mace:dir:attribute-id:test',
      email: 'x@amu.edu.pl',
      displayName: 'Test',
      rawProfileKeys: [],
    };
    const token = service.signSessionToken(user);
    expect(token).toBe('signed.jwt.token');
    expect(jwtService.sign).toHaveBeenCalledWith(
      {
        sub: user.nameId,
        email: user.email,
        displayName: user.displayName,
        nameIDFormat: user.nameIDFormat,
        sessionIndex: user.sessionIndex,
        nameQualifier: user.nameQualifier,
        spNameQualifier: user.spNameQualifier,
        idpIssuer: user.idpIssuer,
      },
      { expiresIn: '8h' },
    );
  });

  it('decodeSessionTokenOrNull returns payload when verify succeeds', () => {
    const out = service.decodeSessionTokenOrNull('any');
    expect(out).toEqual({ sub: 'urn:test', email: 'a@b.pl' });
  });
});
