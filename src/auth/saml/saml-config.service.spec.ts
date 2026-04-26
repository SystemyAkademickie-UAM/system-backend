import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';

import { ValidateInResponseTo } from '@node-saml/node-saml';

import { SAML_IDENTIFIER_FORMAT_DEFAULT } from '../../constants/saml-constants';
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

  it('getValidateInResponseTo returns never when env says never', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'SAML_VALIDATE_IN_RESPONSE_TO' ? 'never' : undefined)),
    } as unknown as ConfigService;
    const service = new SamlConfigService(config);
    expect(service.getValidateInResponseTo()).toBe(ValidateInResponseTo.never);
  });

  it('getValidateInResponseTo defaults to ifPresent when unset', () => {
    const config = { get: jest.fn(() => undefined) } as unknown as ConfigService;
    const service = new SamlConfigService(config);
    expect(service.getValidateInResponseTo()).toBe(ValidateInResponseTo.ifPresent);
  });

  it('getValidateInResponseTo accepts if_present alias', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'SAML_VALIDATE_IN_RESPONSE_TO' ? 'if_present' : undefined)),
    } as unknown as ConfigService;
    const service = new SamlConfigService(config);
    expect(service.getValidateInResponseTo()).toBe(ValidateInResponseTo.ifPresent);
  });

  it('getIdentifierFormat defaults to transient', () => {
    const config = { get: jest.fn(() => undefined) } as unknown as ConfigService;
    const service = new SamlConfigService(config);
    expect(service.getIdentifierFormat()).toBe(SAML_IDENTIFIER_FORMAT_DEFAULT);
  });

  it('getIdentifierFormat uses env when set', () => {
    const custom = 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress';
    const config = {
      get: jest.fn((key: string) => (key === 'SAML_IDENTIFIER_FORMAT' ? custom : undefined)),
    } as unknown as ConfigService;
    const service = new SamlConfigService(config);
    expect(service.getIdentifierFormat()).toBe(custom);
  });
});
