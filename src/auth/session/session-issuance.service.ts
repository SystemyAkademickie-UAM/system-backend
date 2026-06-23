import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';

import { SESSION_RANDOM_BYTE_LENGTH } from '../../constants/session-constants';
import { SessionEntity, LoginMethod } from '../../database/entities/session.entity';
import { SessionHmacService } from './session-hmac.service';

export type CreateSessionOptions = {
  userId: number;
  loginMethod: LoginMethod;
  organizationId?: number | null;
  samlNameId?: string | null;
  samlNameIdFormat?: string | null;
  samlSessionIndex?: string | null;
};

/**
 * Generates plaintext session ids and persists only deterministic HMAC digests.
 */
@Injectable()
export class SessionIssuanceService {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessionRepository: Repository<SessionEntity>,
    private readonly sessionHmacService: SessionHmacService) {}

  /**
   * Creates a new session for the user. Returns the one-time plaintext session id
   * to be stored in the HttpOnly cookie.
   */
  async mintSession(options: CreateSessionOptions): Promise<string> {
    const plaintext = randomBytes(SESSION_RANDOM_BYTE_LENGTH).toString('base64url');
    const sessionHmac = this.sessionHmacService.digestPlainSessionHex(plaintext);
    const idleSeconds = this.sessionHmacService.resolveIdleTimeoutSeconds();
    const absoluteMaxSeconds = this.sessionHmacService.resolveAbsoluteMaxSeconds();
    const now = Date.now();
    const idleExpiry = now + idleSeconds * 1000;
    const absoluteExpiry = now + absoluteMaxSeconds * 1000;
    const expiredAt = new Date(Math.min(idleExpiry, absoluteExpiry));

    const row = this.sessionRepository.create({
      sessionHmac,
      userId: options.userId,
      loginMethod: options.loginMethod,
      organizationId: options.organizationId ?? null,
      samlNameId: options.samlNameId ?? null,
      samlNameIdFormat: options.samlNameIdFormat ?? null,
      samlSessionIndex: options.samlSessionIndex ?? null,
      activeRole: null,
      createdAt: new Date(now),
      expiredAt,
    });
    await this.sessionRepository.save(row);

    return plaintext;
  }

  /**
   * Revokes all sessions for a user (e.g., password change, security event).
   */
  async revokeAllSessionsForUser(userId: number): Promise<void> {
    await this.sessionRepository.delete({ userId });
  }

  /**
   * Revokes a single session by its plaintext id (logout).
   */
  async revokeSession(plaintextSession: string): Promise<void> {
    const normalized = plaintextSession.trim();
    if (normalized === '') {
      return;
    }
    const sessionHmac = this.sessionHmacService.digestPlainSessionHex(normalized);
    await this.sessionRepository.delete({ sessionHmac });
  }

  /**
   * Updates the active role on a session row.
   */
  async setActiveRole(plaintextSession: string, activeRole: string | null): Promise<void> {
    const normalized = plaintextSession.trim();
    if (normalized === '') {
      return;
    }
    const sessionHmac = this.sessionHmacService.digestPlainSessionHex(normalized);
    await this.sessionRepository.update({ sessionHmac }, { activeRole });
  }
}
