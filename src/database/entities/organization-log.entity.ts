import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { ANALYTICS_SCHEMA } from '../../constants/database-schema-constants';
import { ORGANIZATION_LOG_TEXT_MAX_LENGTH } from '../../constants/organization-log-constants';

/**
 * One durable organization action (`analytics.organization_log`).
 * This is the administrator archive. It is not the in-group notification inbox.
 */
@Entity({ schema: ANALYTICS_SCHEMA, name: 'organization_log' })
@Index('idx_organization_log_org_time', ['organizationId', 'occurredAt', 'id'])
@Index('idx_organization_log_org_category_time', ['organizationId', 'category', 'occurredAt', 'id'])
export class OrganizationLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'organization_id', type: 'integer' })
  organizationId: number;

  @Column({ type: 'varchar', length: 32 })
  category: string;

  @Column({ type: 'varchar', length: 64 })
  kind: string;

  @Column({ name: 'occurred_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  occurredAt: Date;

  @Column({ name: 'actor_user_id', type: 'integer', nullable: true })
  actorUserId: number | null;

  @Column({ name: 'actor_name', type: 'varchar', length: ORGANIZATION_LOG_TEXT_MAX_LENGTH, default: '' })
  actorName: string;

  @Column({ name: 'subject_account_id', type: 'integer', nullable: true })
  subjectAccountId: number | null;

  @Column({ name: 'subject_name', type: 'varchar', length: ORGANIZATION_LOG_TEXT_MAX_LENGTH, default: '' })
  subjectName: string;

  @Column({ name: 'group_id', type: 'integer', nullable: true })
  groupId: number | null;

  @Column({ name: 'group_name', type: 'varchar', length: ORGANIZATION_LOG_TEXT_MAX_LENGTH, default: '' })
  groupName: string;

  @Column({ name: 'role_name', type: 'varchar', length: 32, nullable: true })
  roleName: string | null;

  @Column({ name: 'file_kind', type: 'varchar', length: 16, nullable: true })
  fileKind: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: ORGANIZATION_LOG_TEXT_MAX_LENGTH, nullable: true })
  fileName: string | null;

  @Column({ name: 'file_size_bytes', type: 'integer', nullable: true })
  fileSizeBytes: number | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  detail: Record<string, string | number | boolean | null>;
}
