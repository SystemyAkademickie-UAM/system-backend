import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { BROADCAST_TITLE_MAX_LENGTH } from '../../constants/broadcast-constants';
import { SERVICES_SCHEMA } from '../../constants/database-schema-constants';

/**
 * System-wide broadcast announcement (`services.broadcasts`).
 */
@Entity({ schema: SERVICES_SCHEMA, name: 'broadcasts' })
export class BroadcastEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: BROADCAST_TITLE_MAX_LENGTH })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 16, default: 'info' })
  level: string;

  @Column({ name: 'target_role', type: 'varchar', length: 32, default: 'all' })
  targetRole: string;

  @Column({ name: 'expires_at', type: 'timestamp with time zone', nullable: true, default: null })
  expiresAt: Date | null;

  @Column({ name: 'created_by_user_id', type: 'integer', nullable: true, default: null })
  createdByUserId: number | null;

  @Column({ name: 'created_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  createdAt: Date;
}
