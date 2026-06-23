import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { AUTH_TOKEN_HMAC_MAX_LENGTH, AUTH_USER_EMAIL_MAX_LENGTH } from '../../constants/database-entity-constants';
import { AUTH_SCHEMA } from '../../constants/database-schema-constants';

/**
 * One-time email magic link token (`auth.magic_link_tokens`).
 * Stores HMAC digest only; plaintext is emailed once.
 */
@Entity({ schema: AUTH_SCHEMA, name: 'magic_link_tokens' })
export class MagicLinkTokenEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'email', type: 'varchar', length: AUTH_USER_EMAIL_MAX_LENGTH, nullable: false })
  @Index()
  email: string;

  @Column({ name: 'organization_id', type: 'integer', nullable: false })
  @Index()
  organizationId: number;

  @Column({
    name: 'token_hmac',
    type: 'varchar',
    length: AUTH_TOKEN_HMAC_MAX_LENGTH,
    unique: true,
    nullable: false,
  })
  tokenHmac: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: false })
  expiresAt: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true, default: null })
  consumedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: false })
  createdAt: Date;
}
