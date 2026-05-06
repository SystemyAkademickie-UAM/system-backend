import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';

import { OPAQUE_API_TOKEN_RANDOM_BYTE_LENGTH } from '../../constants/api-token-constants';
import { AuthTokenEntity } from '../../database/entities/auth-token.entity';
import { AuthTokenHmacService } from './auth-token-hmac.service';

/**
 * Generates plaintext opaque tokens and persists only deterministic HMAC digests.
 */
@Injectable()
export class AuthTokenIssuanceService {
  constructor(
    @InjectRepository(AuthTokenEntity)
    private readonly authTokenRepository: Repository<AuthTokenEntity>,
    private readonly authTokenHmacService: AuthTokenHmacService,
  ) {}

  /**
   * Replaces prior tokens for the same user/browser pair with a freshly issued plaintext token.
   *
   * @returns one-time plaintext bearer string for `{ "auth": "..." }` responses.
   */
  async revokeAndMintPlainToken(userId: number, browserUuid: string): Promise<string> {
    const plaintext = randomBytes(OPAQUE_API_TOKEN_RANDOM_BYTE_LENGTH).toString('base64url');
    const tokenHmac = this.authTokenHmacService.digestPlainTokenHex(plaintext);
    const ttlSeconds = this.authTokenHmacService.resolveExpiresAfterSeconds();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.authTokenRepository.manager.transaction(async (manager) => {
      await manager.delete(AuthTokenEntity, { userId, browserUuid });
      const row = manager.create(AuthTokenEntity, {
        tokenHmac,
        userId,
        browserUuid,
        expiresAt,
      });
      await manager.save(row);
    });
    return plaintext;
  }
}
