import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the optional `subject_name` column to `education.groups`.
 *
 * Background: course groups (`education.groups`) previously stored only the
 * narrative `name`. The lecturer-facing UI also exposes a separate
 * "subject name" field (e.g. "Mathematics 101") that is independent from the
 * fabular group name. This migration introduces a nullable `subject_name`
 * varchar column so the new field can be persisted without breaking existing
 * rows (the value defaults to NULL for legacy groups).
 *
 * Idempotent — safe to run on databases where the column already exists.
 */
export class AddGroupSubjectName1748204000000 implements MigrationInterface {
  name = 'AddGroupSubjectName1748204000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE education.groups
      ADD COLUMN IF NOT EXISTS subject_name character varying(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE education.groups
      DROP COLUMN IF EXISTS subject_name
    `);
  }
}
