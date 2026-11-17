import type { Request } from 'express';

import {
  MAQ_SESSION_COOKIE_NAME,
  SESSION_ABSOLUTE_MAX_DEFAULT_SECONDS,
  SESSION_IDLE_TIMEOUT_DEFAULT_SECONDS,
} from '../../constants/session-constants';
import { SessionService } from './session.service';

const MILLISECONDS_PER_SECOND = 1000;

describe('SessionService request cache', () => {
  it('serves the cached subject until the request cache is cleared', async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_IDLE_TIMEOUT_DEFAULT_SECONDS * MILLISECONDS_PER_SECOND);
    const storedSession = {
      id: 1,
      userId: 7,
      createdAt: now,
      expiredAt: expiresAt,
    };
    const findOne = jest.fn()
      .mockResolvedValueOnce({
        ...storedSession,
        activeRole: 'lecturer',
        organizationId: 2,
      })
      .mockResolvedValueOnce({
        ...storedSession,
        activeRole: 'student',
        organizationId: 3,
      });
    const service = new SessionService(
      { findOne, update: jest.fn() } as never,
      {
        digestPlainSessionHex: () => 'digest',
        resolveIdleTimeoutSeconds: () => SESSION_IDLE_TIMEOUT_DEFAULT_SECONDS,
        resolveAbsoluteMaxSeconds: () => SESSION_ABSOLUTE_MAX_DEFAULT_SECONDS,
      } as never,
    );
    const req = {
      cookies: { [MAQ_SESSION_COOKIE_NAME]: 'token' },
    } as unknown as Request;

    const first = await service.resolveSubjectFromRequest(req);
    const second = await service.resolveSubjectFromRequest(req);
    service.forgetRequestSubject(req);
    const third = await service.resolveSubjectFromRequest(req);

    expect(first?.activeRole).toBe('lecturer');
    expect(second?.organizationId).toBe(2);
    expect(third?.activeRole).toBe('student');
    expect(third?.organizationId).toBe(3);
    expect(findOne).toHaveBeenCalledTimes(2);
  });
});
