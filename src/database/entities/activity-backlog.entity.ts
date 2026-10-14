import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { ANALYTICS_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Tracks completed activities per student in a group (`analytics.activity_backlog`).
 */
@Entity({ schema: ANALYTICS_SCHEMA, name: 'activity_backlog' })
@Index('idx_activity_backlog_group_account', ['groupId', 'accountId'])
export class ActivityBacklogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK to `education.groups.id`. */
  @Column({ name: 'group_id', type: 'integer', nullable: true })
  groupId: number | null;

  /** FK to `education.activities.id`. */
  @Column({ name: 'activity_id', type: 'integer', nullable: true })
  @Index('idx_activity_backlog_activity_id')
  activityId: number | null;

  /** FK to `auth.accounts.id`. */
  @Column({ name: 'account_id', type: 'integer', nullable: true })
  accountId: number | null;

  @Column({ name: 'date', type: 'timestamp with time zone', nullable: true, default: () => 'CURRENT_TIMESTAMP' })
  date: Date | null;
}
