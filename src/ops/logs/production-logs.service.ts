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

  async listDays(req: Request): Promise<{ days: string[]; timeZone: string }> {
    await this.adminAccessService.assertSuperAdmin(req);
    return { days: this.logStore.listAvailableDates(), timeZone: PRODUCTION_LOG_TIMEZONE };
  }

  async exportEncrypted(
    req: Request,
    clientPublicKeyBase64: string,
    day: string | undefined,
    queryAuth?: string,
    organizationId?: string,
  ): Promise<{ day: string; algorithm: string; serverPublicKey: string; iv: string; ciphertext: string; authTag: string }> {
    await this.adminAccessService.assertSuperAdmin(req, queryAuth);
    const calendarDate = this.resolveDay(day);
    const clientPublicKey = this.parseClientPublicKey(clientPublicKeyBase64);
    let plaintext = this.logStore.readDayPlaintext(calendarDate);
    if (organizationId && organizationId.trim() !== '' && organizationId.trim().toLowerCase() !== 'all') {
      plaintext = this.filterPlaintextByOrganization(plaintext, organizationId.trim());
    }
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

  private filterPlaintextByOrganization(plaintext: Buffer, organizationId: string): Buffer {
    const lines = plaintext.toString('utf8').split(/\r?\n/);
    const isSystemFilter = organizationId.toLowerCase() === 'system';
    const filtered = lines.filter((line) => {
      if (!line.trim()) {
        return false;
      }
      if (isSystemFilter) {
        return this.lineMatchesSystem(line);
      }
      return this.lineMentionsOrganization(line, organizationId);
    });
    return Buffer.from(filtered.join('\n') + (filtered.length > 0 ? '\n' : ''), 'utf8');
  }

  private lineMatchesSystem(line: string): boolean {
    const lower = line.toLowerCase();
    return (
      lower.includes('[org:system]') ||
      lower.includes('[backupservice]') ||
      lower.includes('[backupcontroller]') ||
      lower.includes('[superadminbootstrapservice]') ||
      lower.includes('[maintenancemodeservice]') ||
      lower.includes('[patchnotesservice]') ||
      lower.includes('[documentsservice]') ||
      lower.includes('super admin')
    );
  }

  /**
   * Matches an organization tag or id only when the next character is not another digit,
   * so organization 4 does not also select organization 42.
   */
  private lineMentionsOrganization(line: string, organizationId: string): boolean {
    const lowerLine = line.toLowerCase();
    const lowerId = organizationId.toLowerCase();
    if (lowerLine.includes(`[org:${lowerId}]`)) {
      return true;
    }
    const markers = [
      `organizationid=${lowerId}`,
      `organizationid:${lowerId}`,
      `organizationid: ${lowerId}`,
    ];
    return markers.some((marker) => this.markerEndsBeforeDigit(lowerLine, marker));
  }

  private markerEndsBeforeDigit(line: string, marker: string): boolean {
    let from = 0;
    while (from < line.length) {
      const index = line.indexOf(marker, from);
      if (index < 0) {
        return false;
      }
      const next = line.charAt(index + marker.length);
      if (next === '' || next < '0' || next > '9') {
        return true;
      }
      from = index + 1;
    }
    return false;
  }
}
