import { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE gamification.student_stats
  ADD COLUMN IF NOT EXISTS auto_rank_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE education.stages
  ADD COLUMN IF NOT EXISTS display_order integer;

ALTER TABLE education.posts
  ADD COLUMN IF NOT EXISTS publish_at timestamp with time zone;
`;

const DOWN_SQL = `
ALTER TABLE education.posts
  DROP COLUMN IF EXISTS publish_at;

ALTER TABLE education.stages
  DROP COLUMN IF EXISTS display_order;

ALTER TABLE gamification.student_stats
  DROP COLUMN IF EXISTS auto_rank_enabled;
`;

/**
 * Adds auto_rank_enabled, stage display_order, and scheduled post publish_at columns.
 */
export class BackendBatchFixes141000000000020 implements MigrationInterface {
  name = 'BackendBatchFixes141000000000020';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
