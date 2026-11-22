import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { SessionService } from '../../auth/session/session.service';
import { LogStoreService } from './log-store.service';

/**
 * Middleware recording API traffic, latency, response status, and organization context into production logs.
 */
@Injectable()
export class HttpTrafficLoggerMiddleware implements NestMiddleware {
  constructor(
    private readonly logStore: LogStoreService,
    private readonly sessionService: SessionService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const originalUrl = req.originalUrl || req.url || '/';

    // Do not log static image assets or client logs loop to preserve clean production logs
    if (this.shouldSkipUrl(originalUrl)) {
      return next();
    }

    res.on('finish', () => {
      void this.recordTrafficLine(req, res, startTime, originalUrl);
    });

    next();
  }

  private async recordTrafficLine(
    req: Request,
    res: Response,
    startTime: number,
    originalUrl: string,
  ): Promise<void> {
    try {
      const durationMs = Date.now() - startTime;
      const sanitizedUrl = this.sanitizeUrl(originalUrl);
      const subject = await this.sessionService.resolveSubjectFromRequest(req);

      const orgTag = this.resolveOrgTag(req, subject);
      const level = this.resolveLogLevel(res.statusCode);
      const clientIp = this.resolveClientIp(req);
      const userTag = subject ? subject.userId : 'anonymous';
      const roleTag = subject?.activeRole ?? 'guest';

      const message = `[org:${orgTag}] ${req.method} ${sanitizedUrl} ${res.statusCode} ${durationMs}ms - user:${userTag} role:${roleTag} ip:${clientIp}`;
      this.logStore.appendLine(level, 'HTTP', message);
    } catch {
      // Logging must never interrupt response pipeline or crash the process
    }
  }

  private shouldSkipUrl(url: string): boolean {
    return (
      url.startsWith('/api/assets/') ||
      url.startsWith('/assets/') ||
      url.includes('/client-logs') ||
      url === '/favicon.ico'
    );
  }

  private sanitizeUrl(url: string): string {
    return url.replace(
      /([?&](token|password|secret|key|magicLinkToken|token_hmac)=)[^&]*/gi,
      '$1[REDACTED]',
    );
  }

  private resolveOrgTag(
    req: Request,
    subject: { organizationId: number | null; activeRole: string | null } | null,
  ): string {
    if (subject?.organizationId != null) {
      return String(subject.organizationId);
    }
    if (subject?.activeRole === 'super') {
      return 'system';
    }
    if (!subject) {
      return 'public';
    }
    return 'system';
  }

  private resolveLogLevel(statusCode: number): string {
    if (statusCode >= 500) {
      return 'error';
    }
    if (statusCode >= 400) {
      return 'warn';
    }
    return 'log';
  }

  private resolveClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim() !== '') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
