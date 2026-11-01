import { Column, Entity, PrimaryColumn } from 'typeorm';

import { SERVICES_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Tracks read receipt of a broadcast for a specific user (`services.user_broadcast_status`).
 */
@Entity({ schema: SERVICES_SCHEMA, name: 'user_broadcast_status' })
export class UserBroadcastStatusEntity {
  @PrimaryColumn({ name: 'user_id', type: 'integer' })
  userId: number;

  @PrimaryColumn({ name: 'broadcast_id', type: 'integer' })
  broadcastId: number;

  @Column({ name: 'read_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  readAt: Date;
}
