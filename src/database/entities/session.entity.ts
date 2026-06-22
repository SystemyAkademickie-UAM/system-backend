import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { AUTH_SCHEMA } from '../../constants/database-schema-constants';

/** HMAC hex digest column length (SHA-256 = 64 hex chars). */
export const SESSION_HMAC_MAX_LENGTH = 64;

/** Maximum length for login_method field. */
export const SESSION_LOGIN_METHOD_MAX_LENGTH = 32;

/** Maximum length for active_role field (matches auth.accounts.role). */
export const SESSION_ACTIVE_ROLE_MAX_LENGTH = 32;

/** Maximum length for SAML name_id field. */
export const SESSION_SAML_NAME_ID_MAX_LENGTH = 512;

/** Maximum length for SAML name_id_format field. */
export const SESSION_SAML_NAME_ID_FORMAT_MAX_LENGTH = 256;

/** Maximum length for SAML session_index field. */
export const SESSION_SAML_SESSION_INDEX_MAX_LENGTH = 256;

export type LoginMethod = 'saml' | 'magic_link';

/**
 * Server-side session row (`auth.sessions`).
 * Stores HMAC digest only; plaintext session id lives in HttpOnly cookie.
 *
 * Replaces the old `auth.tokens` table:
 * - Removes browser_uuid binding (X-Browser-ID eliminated).
 * - Adds SAML fields for SLO (nameId, format, sessionIndex).
 * - Adds active_role for server-side role preference.
 */
@Entity({ schema: AUTH_SCHEMA, name: 'sessions' })
export class SessionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** HMAC-SHA256(secret, plaintextSessionId) as hex (plaintext never stored). */
  @Column({
    name: 'session_hmac',
    type: 'varchar',
    length: SESSION_HMAC_MAX_LENGTH,
    unique: true,
    nullable: false,
  })
  sessionHmac: string;

  @Column({ name: 'user_id', type: 'integer', nullable: false })
  userId: number;

  @Column({ name: 'created_at', type: 'timestamptz', nullable: false })
  createdAt: Date;

  @Column({ name: 'expired_at', type: 'timestamptz', nullable: false })
  expiredAt: Date;

  /** How the session was established: 'saml' or 'magic_link'. */
  @Column({
    name: 'login_method',
    type: 'varchar',
    length: SESSION_LOGIN_METHOD_MAX_LENGTH,
    nullable: false,
  })
  loginMethod: LoginMethod;

  /** User's selected active role; must be one they hold in DB. Null = use highest-privilege. */
  @Column({
    name: 'active_role',
    type: 'varchar',
    length: SESSION_ACTIVE_ROLE_MAX_LENGTH,
    nullable: true,
  })
  activeRole: string | null;

  /** Organization id for SAML sessions (needed for SLO routing). Null for magic_link. */
  @Column({ name: 'organization_id', type: 'integer', nullable: true })
  organizationId: number | null;

  /** SAML NameID for SLO requests. */
  @Column({
    name: 'saml_name_id',
    type: 'varchar',
    length: SESSION_SAML_NAME_ID_MAX_LENGTH,
    nullable: true,
  })
  samlNameId: string | null;

  /** SAML NameID format for SLO requests. */
  @Column({
    name: 'saml_name_id_format',
    type: 'varchar',
    length: SESSION_SAML_NAME_ID_FORMAT_MAX_LENGTH,
    nullable: true,
  })
  samlNameIdFormat: string | null;

  /** SAML SessionIndex for SLO requests. */
  @Column({
    name: 'saml_session_index',
    type: 'varchar',
    length: SESSION_SAML_SESSION_INDEX_MAX_LENGTH,
    nullable: true,
  })
  samlSessionIndex: string | null;
}
