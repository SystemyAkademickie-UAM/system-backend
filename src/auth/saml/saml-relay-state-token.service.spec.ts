import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';

import { SamlRelayStateTokenService } from './saml-relay-state-token.service';

describe('SamlRelayStateTokenService', () => {
  let service: SamlRelayStateTokenService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'relay-state-test-secret-min-length',
        }),
      ],
      providers: [SamlRelayStateTokenService],
    }).compile();
    service = module.get(SamlRelayStateTokenService);
  });

  it('creates and parses a relay state token', () => {
    const browserId = '550e8400-e29b-41d4-a716-446655440000';
    const token = service.createRelayStateToken(2, browserId);
    const parsed = service.parseRelayStateToken(token);
    expect(parsed).toEqual({ organizationId: 2, browserId });
  });

  it('returns null for invalid tokens', () => {
    expect(service.parseRelayStateToken('not-a-jwt')).toBeNull();
  });
});
