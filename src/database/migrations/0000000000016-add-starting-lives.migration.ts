import { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE education.groups
ADD COLUMN IF NOT EXISTS starting_lives integer DEFAULT 3;
`;

const DOWN_SQL = `
ALTER TABLE education.groups
DROP COLUMN IF EXISTS starting_lives;
`;

/**
 * Adds \`starting_lives\` to \`education.groups\` to configure how many lives a student starts with.
 */
export class AddStartingLives1719172800016 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
