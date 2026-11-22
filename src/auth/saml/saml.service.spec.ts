import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { SamlConfigService } from './saml-config.service';
import { SamlService } from './saml.service';

describe('SamlService name attributes', () => {
  let service: SamlService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SamlService,
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
        { provide: SamlConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get(SamlService);
  });

  it('reads PIONIER givenName and sn strings without splitting displayName', () => {
    const user = service.mapProfileToUser({
      issuer: 'http://127.0.0.1:5000/simplesaml/saml2/idp/metadata.php',
      nameID: 'name-reversed',
      nameIDFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
      givenName: 'Paweł',
      sn: 'Nawrocki',
      displayName: 'Nawrocki Paweł',
      mail: 'name-reversed@localhost.invalid',
      eduPersonAffiliation: ['student', 'member'],
    });

    expect(user).toEqual(expect.objectContaining({
      givenName: 'Paweł',
      surname: 'Nawrocki',
      displayName: 'Nawrocki Paweł',
    }));
  });

  it('reads givenName and sn by OID and packs several values into one string', () => {
    const user = service.mapProfileToUser({
      issuer: 'http://127.0.0.1:5000/simplesaml/saml2/idp/metadata.php',
      nameID: 'name-two-two',
      nameIDFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
      'urn:oid:2.5.4.42': ['Jan', 'Krzysztof'],
      'urn:oid:2.5.4.4': 'Pawłak-Kowalski',
      mail: 'name-hyphen@localhost.invalid',
      eduPersonAffiliation: ['student'],
    });

    expect(user).toEqual(expect.objectContaining({
      givenName: 'Jan Krzysztof',
      surname: 'Pawłak-Kowalski',
    }));
  });
});
