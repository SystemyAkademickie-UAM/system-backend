import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
  CREATE INDEX IF NOT EXISTS "idx_backlog_group_account_unread" ON "analytics"."backlog" ("group_id", "account_id", "is_read");
  CREATE INDEX IF NOT EXISTS "idx_backlog_group_unread" ON "analytics"."backlog" ("group_id", "is_read");
  CREATE INDEX IF NOT EXISTS "idx_backlog_group_date" ON "analytics"."backlog" ("group_id", "date" DESC);
  CREATE INDEX IF NOT EXISTS "idx_backlog_account_id" ON "analytics"."backlog" ("account_id");
  CREATE INDEX IF NOT EXISTS "idx_activity_backlog_group_account" ON "analytics"."activity_backlog" ("group_id", "account_id");
  CREATE INDEX IF NOT EXISTS "idx_activity_backlog_activity_id" ON "analytics"."activity_backlog" ("activity_id");
`.trim();

const DOWN_SQL = `
  DROP INDEX IF EXISTS "analytics"."idx_activity_backlog_activity_id";
  DROP INDEX IF EXISTS "analytics"."idx_activity_backlog_group_account";
  DROP INDEX IF EXISTS "analytics"."idx_backlog_account_id";
  DROP INDEX IF EXISTS "analytics"."idx_backlog_group_date";
  DROP INDEX IF EXISTS "analytics"."idx_backlog_group_unread";
  DROP INDEX IF EXISTS "analytics"."idx_backlog_group_account_unread";
`.trim();

export class BacklogIndexes0000000000026 implements MigrationInterface {
  name = 'BacklogIndexes0000000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
