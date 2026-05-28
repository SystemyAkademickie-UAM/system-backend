import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRarityToBadges1748200000000 implements MigrationInterface {
  name = 'AddRarityToBadges1748200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gamification.badges 
      ADD COLUMN IF NOT EXISTS rarity character varying(20) DEFAULT 'common' NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE gamification.badges 
      DROP COLUMN IF EXISTS rarity
    `);
  }
}
