import { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE education.groups
  RENAME COLUMN currency_icon TO currency_emoji;
`;

const DOWN_SQL = `
ALTER TABLE education.groups
  RENAME COLUMN currency_emoji TO currency_icon;
`;

/**
 * Renames `education.groups.currency_icon` → `currency_emoji`.
 * The column now stores ASCII emoji characters instead of SVG path references.
 */
export class RenameCurrencyIconToEmoji1719172800015 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
