import type { NextFunction, Request, Response } from 'express';

import { HttpTrafficLoggerMiddleware } from './http-traffic-logger.middleware';

describe('HttpTrafficLoggerMiddleware', () => {
  let middleware: HttpTrafficLoggerMiddleware;
  let logStore: { appendLine: jest.Mock };
  let sessionService: { resolveSubjectFromRequest: jest.Mock };

  beforeEach(() => {
    logStore = { appendLine: jest.fn() };
    sessionService = { resolveSubjectFromRequest: jest.fn() };
    middleware = new HttpTrafficLoggerMiddleware(logStore as any, sessionService as any);
  });

  function createMockContext(url: string, statusCode = 200) {
    const finishListeners: (() => void)[] = [];
    const req = {
      url,
      originalUrl: url,
      method: 'GET',
      headers: { 'x-forwarded-for': '192.168.1.100' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;

    const res = {
      statusCode,
      on: jest.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishListeners.push(callback);
        }
      }),
    } as unknown as Response;

    const next: NextFunction = jest.fn();

    const triggerFinish = async () => {
      for (const listener of finishListeners) {
        listener();
      }
      // allow async microtasks inside finish handler to settle
      await new Promise((resolve) => setImmediate(resolve));
    };

    return { req, res, next, triggerFinish };
  }

  it('skips logging for static assets and client-logs', async () => {
    const { req, res, next, triggerFinish } = createMockContext('/api/assets/banners/1.png');

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();

    await triggerFinish();
    expect(logStore.appendLine).not.toHaveBeenCalled();
  });

  it('logs regular request with organization tag and user info on finish', async () => {
    sessionService.resolveSubjectFromRequest.mockResolvedValue({
      userId: 5,
      activeRole: 'student',
      organizationId: 2,
    });

    const { req, res, next, triggerFinish } = createMockContext('/api/groups', 200);

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();

    await triggerFinish();

    expect(logStore.appendLine).toHaveBeenCalledWith(
      'log',
      'HTTP',
      expect.stringContaining('[org:2] GET /api/groups 200'),
    );
    expect(logStore.appendLine).toHaveBeenCalledWith(
      'log',
      'HTTP',
      expect.stringContaining('user:5 role:student ip:192.168.1.100'),
    );
  });

  it('redacts sensitive query parameters in URL', async () => {
    sessionService.resolveSubjectFromRequest.mockResolvedValue(null);

    const { req, res, next, triggerFinish } = createMockContext(
      '/api/auth/magic-link?token=verysecret123&foo=bar',
      200,
    );

    middleware.use(req, res, next);
    await triggerFinish();

    expect(logStore.appendLine).toHaveBeenCalledWith(
      'log',
      'HTTP',
      expect.not.stringContaining('verysecret123'),
    );
    expect(logStore.appendLine).toHaveBeenCalledWith(
      'log',
      'HTTP',
      expect.stringContaining('token=[REDACTED]'),
    );
  });

  it('records error level for 500 status code and warn for 400', async () => {
    sessionService.resolveSubjectFromRequest.mockResolvedValue({
      userId: 1,
      activeRole: 'super',
      organizationId: null,
    });

    const context500 = createMockContext('/api/admin/error', 500);
    middleware.use(context500.req, context500.res, context500.next);
    await context500.triggerFinish();

    expect(logStore.appendLine).toHaveBeenCalledWith(
      'error',
      'HTTP',
      expect.stringContaining('[org:system] GET /api/admin/error 500'),
    );

    const context404 = createMockContext('/api/not-found', 404);
    middleware.use(context404.req, context404.res, context404.next);
    await context404.triggerFinish();

    expect(logStore.appendLine).toHaveBeenCalledWith(
      'warn',
      'HTTP',
      expect.stringContaining('404'),
    );
  });
});
