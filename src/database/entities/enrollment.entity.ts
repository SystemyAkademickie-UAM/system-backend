import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { GAMIFICATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Student membership in a course group (`gamification.enrollments`).
 */
@Entity({ schema: GAMIFICATION_SCHEMA, name: 'enrollments' })
export class EnrollmentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK to `education.groups.id`. */
  @Column({ name: 'group_id', type: 'integer', nullable: false })
  groupId: number;

  /** FK to `auth.accounts.id` where role is the student role. */
  @Column({ name: 'student_account_id', type: 'integer', nullable: false })
  studentAccountId: number;
}
