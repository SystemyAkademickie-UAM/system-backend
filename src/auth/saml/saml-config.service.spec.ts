import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';

import { SamlConfigService } from './saml-config.service';

jest.mock('node:fs', () => ({
  readFileSync: jest.fn(),
}));

describe('SamlConfigService', () => {
  const mockedReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

  beforeEach(() => {
    mockedReadFileSync.mockReset();
  });

  it('getIdpCert returns undefined when PEM path read fails', () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'SAML_IDP_CERT_PATH') {
          return '/nonexistent/idp.pem';
        }
        return undefined;
      }),
    } as unknown as ConfigService;
    const service = new SamlConfigService(config);
    expect(service.getIdpCert()).toBeUndefined();
  });

  it('getIdpCert returns file contents when read succeeds', () => {
    mockedReadFileSync.mockReturnValue('-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----');
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'SAML_IDP_CERT_PATH') {
          return '/ok/idp.pem';
        }
        return undefined;
      }),
    } as unknown as ConfigService;
    const service = new SamlConfigService(config);
    expect(service.getIdpCert()).toContain('BEGIN CERTIFICATE');
  });
});
