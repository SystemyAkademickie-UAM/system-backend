import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE education.posts
ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

ALTER TABLE education.posts
ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT NULL;

ALTER TABLE education.posts
ADD COLUMN IF NOT EXISTS published_at timestamp without time zone DEFAULT NULL;
`.trim();

const DOWN_SQL = `
ALTER TABLE education.posts DROP COLUMN IF EXISTS published_at;
ALTER TABLE education.posts DROP COLUMN IF EXISTS created_at;
ALTER TABLE education.posts DROP COLUMN IF EXISTS is_published;
`.trim();

/**
 * Migration 011 — adds publishing workflow columns to `education.posts`.
 * - `is_published` (boolean) — visibility toggle for lecturers.
 * - `created_at` (timestamp) — creation date sent from the frontend.
 * - `published_at` (timestamp) — auto-set by the backend when `is_published` flips to `true`.
 */
export class PostPublishing0000000000011 implements MigrationInterface {
  name = 'PostPublishing0000000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
