import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE gamification.item_categories
  ADD COLUMN IF NOT EXISTS color varchar(32);
`.trim();

const DOWN_SQL = `
ALTER TABLE gamification.item_categories DROP COLUMN IF EXISTS color;
`.trim();

export class AddItemCategoryColor0000000000023 implements MigrationInterface {
  name = 'AddItemCategoryColor0000000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
