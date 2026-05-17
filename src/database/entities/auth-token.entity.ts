import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { AUTH_TOKEN_HMAC_MAX_LENGTH } from '../../constants/database-entity-constants';
import { AUTH_SCHEMA } from '../../constants/database-schema-constants';

/**
 * API opaque token fingerprint (HMAC digest only), bound to browser UUID and TTL.
 * Maps to PostgreSQL `auth.tokens`.
 *
 * Note: `created_at` must be set in application code — production DDL often has NOT NULL without DEFAULT,
 * while TypeORM `@CreateDateColumn` emits SQL `DEFAULT`, which yields NULL on those tables.
 */
@Entity({ schema: AUTH_SCHEMA, name: 'tokens' })
export class AuthTokenEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** HMAC-SHA256(secret, plaintextToken) serialized as hexadecimal (plaintext never persisted). */
  @Column({
    name: 'token_hmac',
    type: 'varchar',
    length: AUTH_TOKEN_HMAC_MAX_LENGTH,
    unique: true,
    nullable: false
  })
  tokenHmac: string;

  @Column({ name: 'browser_uuid', type: 'uuid', nullable: false })
  browserUuid: string;

  @Column({ name: 'user_id', type: 'integer', nullable: false })
  userId: number;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: false })
  createdAt: Date;

  @Column({ name: 'expired_at', type: 'timestamptz', nullable: false })
  expiredAt: Date;
}
