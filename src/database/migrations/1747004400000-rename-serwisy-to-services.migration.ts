import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames the `serwisy` schema to `services` for English consistency.
 * The `drive` table and all related sequences/constraints are moved automatically.
 */
export class RenameSerwisyToServices1747004400000 implements MigrationInterface {
  name = 'RenameSerwisyToServices1747004400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent: rename only when the legacy schema still exists.
    // (Snapshots created with db_v3.sql already ship `services`.)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'serwisy')
           AND NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'services') THEN
          EXECUTE 'ALTER SCHEMA serwisy RENAME TO services';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'services')
           AND NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'serwisy') THEN
          EXECUTE 'ALTER SCHEMA services RENAME TO serwisy';
        END IF;
      END
      $$;
    `);
  }
}
