import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { GAMIFICATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Records that a student has earned a specific badge (`gamification.earned_badges`).
 */
@Entity({ schema: GAMIFICATION_SCHEMA, name: 'earned_badges' })
export class EarnedBadgeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK to `gamification.enrollments.id`. */
  @Column({ name: 'enrollment_id', type: 'integer', nullable: true })
  enrollmentId: number | null;

  /** FK to `gamification.badges.id`. */
  @Column({ name: 'badge_id', type: 'integer', nullable: true })
  badgeId: number | null;
}
