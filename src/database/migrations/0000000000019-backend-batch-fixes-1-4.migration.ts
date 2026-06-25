import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 019 — implements DDL for fixes #1, #3, and #4:
 * - auto_rank_enabled on gamification.student_stats
 * - display_order on education.stages
 * - publish_at on education.posts
 */
export class BackendBatchFixes141000000000019 implements MigrationInterface {
  name = 'BackendBatchFixes141000000000019';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gamification.student_stats
        ADD COLUMN IF NOT EXISTS auto_rank_enabled boolean NOT NULL DEFAULT true;
    `);

    await queryRunner.query(`
      ALTER TABLE education.stages
        ADD COLUMN IF NOT EXISTS display_order integer;
    `);

    await queryRunner.query(`
      ALTER TABLE education.posts
        ADD COLUMN IF NOT EXISTS publish_at timestamp;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE education.posts
        DROP COLUMN IF EXISTS publish_at;
    `);

    await queryRunner.query(`
      ALTER TABLE education.stages
        DROP COLUMN IF EXISTS display_order;
    `);

    await queryRunner.query(`
      ALTER TABLE gamification.student_stats
        DROP COLUMN IF EXISTS auto_rank_enabled;
    `);
  }
}
