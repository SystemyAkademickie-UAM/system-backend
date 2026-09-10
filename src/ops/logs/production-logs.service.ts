import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { AdminAccessService } from '../../admin/admin-access.service';
import { SessionService } from '../../auth/session/session.service';
import {
  PRODUCTION_LOG_DATE_PATTERN,
  PRODUCTION_LOG_ECDH_UNCOMPRESSED_PREFIX,
  PRODUCTION_LOG_ECDH_UNCOMPRESSED_PUBLIC_KEY_LENGTH,
  PRODUCTION_LOG_TIMEZONE,
  PRODUCTION_LOG_TODAY_ALIAS,
} from '../../constants/production-log-constants';
import { formatLogCalendarDate } from './log-calendar';
import { encryptLogPayload } from './log-export-crypto';
import { LogStoreService } from './log-store.service';

/**
 * Superadmin list/export and authenticated browser ingest.
 */
@Injectable()
export class ProductionLogsService {
  constructor(
    private readonly logStore: LogStoreService,
    private readonly adminAccessService: AdminAccessService,
    private readonly sessionService: SessionService,
  ) {}

  async listDays(req: Request, queryAuth?: string): Promise<{ days: string[]; timeZone: string }> {
    await this.adminAccessService.assertSuperAdmin(req, queryAuth);
    return { days: this.logStore.listAvailableDates(), timeZone: PRODUCTION_LOG_TIMEZONE };
  }

  async exportEncrypted(
    req: Request,
    clientPublicKeyBase64: string,
    day: string | undefined,
    queryAuth?: string,
  ): Promise<{ day: string; algorithm: string; serverPublicKey: string; iv: string; ciphertext: string; authTag: string }> {
    await this.adminAccessService.assertSuperAdmin(req, queryAuth);
    const calendarDate = this.resolveDay(day);
    const clientPublicKey = this.parseClientPublicKey(clientPublicKeyBase64);
    const plaintext = this.logStore.readDayPlaintext(calendarDate);
    const encrypted = encryptLogPayload(plaintext, clientPublicKey);
    return { day: calendarDate, ...encrypted };
  }

  async ingestClientLog(
    req: Request,
    level: string,
    message: string,
    source?: string,
  ): Promise<{ accepted: boolean }> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req);
    if (subject === null) {
      throw new ForbiddenException('Not authorized');
    }
    const context = `browser user=${subject.userId}${source ? ` ${source}` : ''}`;
    this.logStore.appendLine(level, context, message);
    return { accepted: true };
  }

  private resolveDay(day: string | undefined): string {
    if (day === undefined || day === PRODUCTION_LOG_TODAY_ALIAS) {
      return formatLogCalendarDate(new Date());
    }
    if (!PRODUCTION_LOG_DATE_PATTERN.test(day)) {
      throw new BadRequestException('Invalid day');
    }
    return day;
  }

  private parseClientPublicKey(clientPublicKeyBase64: string): Buffer {
    let decoded: Buffer;
    try {
      decoded = Buffer.from(clientPublicKeyBase64, 'base64');
    } catch {
      throw new BadRequestException('Invalid client public key');
    }
    if (
      decoded.length !== PRODUCTION_LOG_ECDH_UNCOMPRESSED_PUBLIC_KEY_LENGTH ||
      decoded[0] !== PRODUCTION_LOG_ECDH_UNCOMPRESSED_PREFIX
    ) {
      throw new BadRequestException('Invalid client public key');
    }
    return decoded;
  }
}
