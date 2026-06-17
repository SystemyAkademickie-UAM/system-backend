import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE gamification.badges
ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

ALTER TABLE gamification.badges
ADD COLUMN IF NOT EXISTS published_at timestamp without time zone DEFAULT NULL;

ALTER TABLE gamification.items
ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

ALTER TABLE gamification.items
ADD COLUMN IF NOT EXISTS published_at timestamp without time zone DEFAULT NULL;

ALTER TABLE education.stages
ADD COLUMN IF NOT EXISTS visibility_status integer NOT NULL DEFAULT 0;

UPDATE gamification.badges SET is_published = true, published_at = NOW();
UPDATE gamification.items SET is_published = true, published_at = NOW();
UPDATE education.stages SET visibility_status = 1;
`.trim();

const DOWN_SQL = `
ALTER TABLE education.stages DROP COLUMN IF EXISTS visibility_status;
ALTER TABLE gamification.items DROP COLUMN IF EXISTS published_at;
ALTER TABLE gamification.items DROP COLUMN IF EXISTS is_published;
ALTER TABLE gamification.badges DROP COLUMN IF EXISTS published_at;
ALTER TABLE gamification.badges DROP COLUMN IF EXISTS is_published;
`.trim();

/**
 * Migration 013 — adds visibility toggles for badges, items, and stages.
 */
export class VisibilityToggles0000000000013 implements MigrationInterface {
  name = 'VisibilityToggles0000000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
