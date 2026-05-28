import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = 'SELECT 1;';

const DOWN_SQL = 'SELECT 1;';

/**
 * Migration 001 — marks the schema baseline captured in `maq.sql` (fresh DB bootstrap).
 * TypeORM requires a 13-digit timestamp suffix on the class name (here: 0000000000001).
 * Next incremental migration: 0000000000002-*.migration.ts
 */
export class Baseline0000000000001 implements MigrationInterface {
  name = 'Baseline0000000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
