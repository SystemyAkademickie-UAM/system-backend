import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE education.activities
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE;
`.trim();

const DOWN_SQL = `
ALTER TABLE education.activities
  DROP COLUMN IF EXISTS is_visible;
`.trim();

/**
 * Dodanie kolumny is_visible do tabeli education.activities.
 */
export class AddIsVisibleToActivities0000000000024 implements MigrationInterface {
  name = 'AddIsVisibleToActivities0000000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
