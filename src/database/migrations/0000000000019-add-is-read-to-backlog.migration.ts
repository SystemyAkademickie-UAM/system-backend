import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE analytics.backlog ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
`.trim();

const DOWN_SQL = `
ALTER TABLE analytics.backlog DROP COLUMN IF EXISTS is_read;
`.trim();

export class AddIsReadToBacklog0000000000019 implements MigrationInterface {
  name = 'AddIsReadToBacklog0000000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
