import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { EDUCATION_ENROLLMENT_CODE_MAX_LENGTH } from '../../constants/database-entity-constants';
import { EDUCATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Group-scoped enrollment invite code (`education.enrollment_codes`).
 */
@Entity({ schema: EDUCATION_SCHEMA, name: 'enrollment_codes' })
export class EnrollmentCodeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'group_id', type: 'integer', nullable: false })
  groupId: number;

  @Column({ name: 'code', type: 'varchar', length: EDUCATION_ENROLLMENT_CODE_MAX_LENGTH, nullable: false })
  code: string;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  /** Maximum successful enrollments; `null` means unlimited. */
  @Column({ name: 'max_uses', type: 'integer', nullable: true })
  maxUses: number | null;

  @Column({ name: 'use_count', type: 'integer', nullable: false, default: 0 })
  useCount: number;

  @Column({ name: 'is_active', type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
