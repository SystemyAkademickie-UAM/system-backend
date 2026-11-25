import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE gamification.badges
ADD COLUMN IF NOT EXISTS is_secret boolean NOT NULL DEFAULT false;
`.trim();

const DOWN_SQL = `
ALTER TABLE gamification.badges DROP COLUMN IF EXISTS is_secret;
`.trim();

/**
 * Migration 038 — adds the secret badge flag (`gamification.badges.is_secret`).
 */
export class SecretBadges0000000000038 implements MigrationInterface {
  name = 'SecretBadges0000000000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
