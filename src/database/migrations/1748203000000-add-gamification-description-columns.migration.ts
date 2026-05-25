import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds English gamification columns missing from databases created before db_v3.sql
 * (badges/ranks tables often existed with only id, group_id, name, icon, required_points).
 */
export class AddGamificationDescriptionColumns1748203000000 implements MigrationInterface {
  name = 'AddGamificationDescriptionColumns1748203000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gamification.badges
      ADD COLUMN IF NOT EXISTS educational_description text
    `);

    await queryRunner.query(`
      ALTER TABLE gamification.badges
      ADD COLUMN IF NOT EXISTS story_description text
    `);

    await queryRunner.query(`
      ALTER TABLE gamification.badges
      ADD COLUMN IF NOT EXISTS reward_amount integer DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE gamification.badges
      ADD COLUMN IF NOT EXISTS icon character varying(255)
    `);

    await queryRunner.query(`
      ALTER TABLE gamification.badges
      ADD COLUMN IF NOT EXISTS rarity character varying(20) DEFAULT 'common' NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE gamification.ranks
      ADD COLUMN IF NOT EXISTS icon character varying(255)
    `);

    await queryRunner.query(`
      ALTER TABLE gamification.ranks
      ADD COLUMN IF NOT EXISTS story_description text
    `);

    await queryRunner.query(`
      ALTER TABLE gamification.ranks
      ADD COLUMN IF NOT EXISTS store_discount integer DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE gamification.ranks
      ADD COLUMN IF NOT EXISTS unique_store_items text[]
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive catch-up migration — no down.
  }
}
