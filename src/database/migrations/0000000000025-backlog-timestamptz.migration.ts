import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
  ALTER TABLE "analytics"."backlog" ALTER COLUMN "date" TYPE TIMESTAMP WITH TIME ZONE;
  ALTER TABLE "analytics"."activity_backlog" ALTER COLUMN "date" TYPE TIMESTAMP WITH TIME ZONE;
`.trim();

const DOWN_SQL = `
  ALTER TABLE "analytics"."activity_backlog" ALTER COLUMN "date" TYPE TIMESTAMP WITHOUT TIME ZONE;
  ALTER TABLE "analytics"."backlog" ALTER COLUMN "date" TYPE TIMESTAMP WITHOUT TIME ZONE;
`.trim();

export class BacklogTimestamptz0000000000025 implements MigrationInterface {
  name = 'BacklogTimestamptz0000000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
