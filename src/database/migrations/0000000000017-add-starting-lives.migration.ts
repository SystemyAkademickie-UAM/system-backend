import { MigrationInterface, QueryRunner } from 'typeorm';

const ADD_COLUMNS_SQL = `
ALTER TABLE education.groups
ADD COLUMN IF NOT EXISTS starting_lives integer DEFAULT 3;

ALTER TABLE gamification.student_stats
ADD COLUMN IF NOT EXISTS lives integer DEFAULT 3;
`;

const BACKFILL_GROUP_STARTING_LIVES_SQL = `
UPDATE education.groups
SET starting_lives = COALESCE(lives, 3);
`;

const BACKFILL_STUDENT_STATS_LIVES_SQL = `
UPDATE gamification.student_stats ss
SET lives = COALESCE(g.starting_lives, g.lives, 3)
FROM gamification.enrollments e
INNER JOIN education.groups g ON g.id = e.group_id
WHERE ss.enrollment_id = e.id;
`;

const DOWN_SQL = `
ALTER TABLE gamification.student_stats
DROP COLUMN IF EXISTS lives;

ALTER TABLE education.groups
DROP COLUMN IF EXISTS starting_lives;
`;

/**
 * Adds `starting_lives` to groups and per-student `lives` on enrollments, backfilling from existing group caps.
 */
export class AddStartingLives1719172800017 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(ADD_COLUMNS_SQL);
    await queryRunner.query(BACKFILL_GROUP_STARTING_LIVES_SQL);
    await queryRunner.query(BACKFILL_STUDENT_STATS_LIVES_SQL);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
