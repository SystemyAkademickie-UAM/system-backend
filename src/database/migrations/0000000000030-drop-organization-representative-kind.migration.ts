import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE auth.organizations
  DROP COLUMN IF EXISTS representative_kind;
`.trim();

/** Previous width of the dropped `representative_kind` column, restored only by `down`. */
const DROPPED_REPRESENTATIVE_KIND_LENGTH = 32;

const DOWN_SQL = `
ALTER TABLE auth.organizations
  ADD COLUMN IF NOT EXISTS representative_kind character varying(${DROPPED_REPRESENTATIVE_KIND_LENGTH});
`.trim();

/**
 * Migration 030 — drop `representative_kind`. The contact is a name, email, and optional phone.
 */
export class DropOrganizationRepresentativeKind0000000000030 implements MigrationInterface {
  name = 'DropOrganizationRepresentativeKind0000000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
