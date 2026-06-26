import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS show_nickname boolean NOT NULL DEFAULT true;
`.trim();

const DOWN_SQL = `
ALTER TABLE auth.users
  DROP COLUMN IF EXISTS show_nickname;
`.trim();

export class AddUserShowNickname0000000000026 implements MigrationInterface {
  name = 'AddUserShowNickname0000000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
