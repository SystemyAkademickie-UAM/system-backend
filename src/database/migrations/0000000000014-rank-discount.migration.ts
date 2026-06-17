import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE gamification.ranks ADD COLUMN IF NOT EXISTS discount decimal(5,2) DEFAULT 0;
`.trim();

const DOWN_SQL = `
ALTER TABLE gamification.ranks DROP COLUMN IF EXISTS discount;
`.trim();

export class RankDiscount0000000000014 implements MigrationInterface {
  name = 'RankDiscount0000000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
