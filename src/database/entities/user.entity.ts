import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { AUTH_SCHEMA } from '../../constants/database-schema-constants';
import {
  AUTH_USER_EMAIL_MAX_LENGTH,
  AUTH_USER_LANGUAGE_MAX_LENGTH,
  AUTH_USER_NAME_FIELD_MAX_LENGTH,
} from '../../constants/database-entity-constants';

/**
 * Application user (`auth.users`).
 */
@Entity({ schema: AUTH_SCHEMA, name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: AUTH_USER_EMAIL_MAX_LENGTH })
  email: string;

  /** Institutional student id (integer). */
  @Column({ name: 'student_id', type: 'integer', nullable: false })
  studentId: number;

  @Column({ type: 'varchar', length: AUTH_USER_NAME_FIELD_MAX_LENGTH })
  name: string;

  @Column({ type: 'varchar', length: AUTH_USER_NAME_FIELD_MAX_LENGTH })
  surname: string;

  @Column({ type: 'varchar', length: AUTH_USER_NAME_FIELD_MAX_LENGTH })
  nickname: string;

  @Column({ name: 'avatar_id', type: 'integer', nullable: false })
  avatarId: number;

  @Column({ type: 'varchar', length: AUTH_USER_LANGUAGE_MAX_LENGTH, nullable: true, default: 'PL' })
  language: string | null;

  /** When false, lecturer name is shown as legal name instead of nickname to others. */
  @Column({ name: 'show_nickname', type: 'boolean', nullable: false, default: true })
  showNickname: boolean;

  /** Whether the user has completed the registration flow (nickname + avatar). */
  @Column({ name: 'registration_completed', type: 'boolean', nullable: false, default: false })
  registrationCompleted: boolean;

  /** Timestamp when the user accepted EULA (null if not accepted). */
  @Column({ name: 'eula_accepted_at', type: 'timestamp', nullable: true, default: null })
  eulaAcceptedAt: Date | null;

  /** Set when nickname/avatar are saved during the registration wizard (before EULA). */
  @Column({ name: 'profile_submitted_at', type: 'timestamp', nullable: true, default: null })
  profileSubmittedAt: Date | null;
}
