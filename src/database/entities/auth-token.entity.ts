import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * API opaque token fingerprint (HMAC digest only), bound to browser and TTL.
 */
@Entity('auth_tokens')
export class AuthTokenEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** HMAC-SHA256(secret, plaintextToken) serialized as hexadecimal (plaintext never persisted). */
  @Column({ name: 'token_hmac', type: 'varchar', length: 64, unique: true })
  tokenHmac: string;

  @Column({ name: 'browser_uuid', type: 'varchar', length: 64 })
  browserUuid: string;

  @Column({ name: 'user_id' })
  userId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
