import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { ANALYTICS_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Tracks general backlog events per group and account (`analytics.backlog`).
 */
@Entity({ schema: ANALYTICS_SCHEMA, name: 'backlog' })
export class BacklogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK to `education.groups.id`. */
  @Column({ name: 'group_id', type: 'integer', nullable: true })
  groupId: number | null;

  /** FK to `auth.accounts.id`. */
  @Column({ name: 'account_id', type: 'integer', nullable: true })
  accountId: number | null;

  /** Event type identifier, e.g., 'SHOP_PURCHASE', 'ACTIVITY_COMPLETED' */
  @Column({ name: 'type', type: 'varchar', length: 100, nullable: true })
  type: string | null;

  @Column({ name: 'date', type: 'timestamp', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  date: Date | null;

  /** Detailed value or JSON string regarding the event */
  @Column({ name: 'value', type: 'text', nullable: true })
  value: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;
}
