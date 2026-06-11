import type { Request } from 'express';

import { AuthTokenSessionService } from './auth-token-session-service';
import { AuthTokenHmacService } from './auth-token-hmac.service';

describe('AuthTokenSessionService', () => {
  const digestHex = 'a'.repeat(64);
  const browserUuid = '550e8400-e29b-41d4-a716-446655440000';
  const staleBrowserUuid = '660e8400-e29b-41d4-a716-446655440001';

  const authTokenRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const authTokenHmacService = {
    digestPlainTokenHex: jest.fn(() => digestHex),
    resolveIdleTimeoutSeconds: jest.fn(() => 24 * 60),
    resolveAbsoluteMaxSeconds: jest.fn(() => 8 * 60 * 60),
  } as unknown as AuthTokenHmacService;

  const service = new AuthTokenSessionService(
    authTokenRepository as never,
    authTokenHmacService,
  );

  const req = {
    cookies: { maq_auth: 'opaque-token' },
  } as unknown as Request;

  beforeEach(() => {
    jest.clearAllMocks();
    authTokenRepository.findOne.mockResolvedValue({
      userId: 42,
      browserUuid,
      tokenHmac: digestHex,
    });
  });

  it('resolveSubjectStrongOrSoftFromRequest returns strong subject when browser id matches', async () => {
    const subject = await service.resolveSubjectStrongOrSoftFromRequest(req, browserUuid, undefined);
    expect(subject).toEqual({ userId: 42 });
    expect(authTokenRepository.findOne).toHaveBeenCalledTimes(1);
  });

  it('resolveSubjectStrongOrSoftFromRequest falls back to soft auth when browser id mismatches', async () => {
    const subject = await service.resolveSubjectStrongOrSoftFromRequest(req, staleBrowserUuid, undefined);
    expect(subject).toEqual({ userId: 42 });
    expect(authTokenRepository.findOne).toHaveBeenCalledTimes(2);
  });

  it('slides expired_at forward on activity, capped by the absolute deadline', async () => {
    const createdAt = new Date(Date.now() - 60 * 60 * 1000);
    const expiredAt = new Date(Date.now() + 60 * 1000);
    authTokenRepository.findOne.mockResolvedValue({
      id: 7,
      userId: 42,
      browserUuid,
      tokenHmac: digestHex,
      createdAt,
      expiredAt,
    });
    await service.resolveSubjectSoftFromRequest(req, undefined);
    expect(authTokenRepository.update).toHaveBeenCalledTimes(1);
    const [, patch] = authTokenRepository.update.mock.calls[0];
    expect(patch.expiredAt.getTime()).toBeGreaterThan(expiredAt.getTime());
    const absoluteDeadline = createdAt.getTime() + 8 * 60 * 60 * 1000;
    expect(patch.expiredAt.getTime()).toBeLessThanOrEqual(absoluteDeadline);
  });

  it('does not write when the idle window would not advance expiry past the threshold', async () => {
    const createdAt = new Date(Date.now() - 60 * 1000);
    const expiredAt = new Date(Date.now() + 24 * 60 * 1000);
    authTokenRepository.findOne.mockResolvedValue({
      id: 8,
      userId: 42,
      browserUuid,
      tokenHmac: digestHex,
      createdAt,
      expiredAt,
    });
    await service.resolveSubjectSoftFromRequest(req, undefined);
    expect(authTokenRepository.update).not.toHaveBeenCalled();
  });

  it('reads the token from an Authorization: Bearer header when no cookie is present', async () => {
    const bearerReq = {
      cookies: {},
      headers: { authorization: 'Bearer header-token' },
    } as unknown as Request;
    const subject = await service.resolveSubjectSoftFromRequest(bearerReq, undefined);
    expect(subject).toEqual({ userId: 42 });
  });
});
