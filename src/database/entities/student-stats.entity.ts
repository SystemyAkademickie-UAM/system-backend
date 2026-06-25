import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { GAMIFICATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Per-enrollment statistics for a student (`gamification.student_stats`).
 */
@Entity({ schema: GAMIFICATION_SCHEMA, name: 'student_stats' })
export class StudentStatsEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK to `gamification.enrollments.id` (unique — one stats row per enrollment). */
  @Column({ name: 'enrollment_id', type: 'integer', nullable: true, unique: true })
  enrollmentId: number | null;

  @Column({ name: 'currency', type: 'integer', nullable: true, default: 0 })
  currency: number | null;

  @Column({ name: 'total_earned', type: 'integer', nullable: true, default: 0 })
  totalEarned: number | null;

  /** FK to `gamification.ranks.id`. */
  @Column({ name: 'rank_id', type: 'integer', nullable: true })
  rankId: number | null;

  /** Whether automatic rank assignment based on totalEarned is active. */
  @Column({ name: 'auto_rank_enabled', type: 'boolean', default: true })
  autoRankEnabled: boolean;

  @Column({ name: 'lives', type: 'integer', nullable: true, default: 3 })
  lives: number | null;
}
