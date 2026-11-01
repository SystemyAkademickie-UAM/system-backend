import type { MigrationInterface, QueryRunner } from 'typeorm';

import { AUTH_ACCOUNT_ROLE_MAX_LENGTH } from '../../constants/database-entity-constants';

const UP_SQL = `
ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS last_organization_id integer,
  ADD COLUMN IF NOT EXISTS last_role character varying(${AUTH_ACCOUNT_ROLE_MAX_LENGTH});

ALTER TABLE auth.users
  DROP CONSTRAINT IF EXISTS users_last_organization_id_fkey;

ALTER TABLE auth.users
  ADD CONSTRAINT users_last_organization_id_fkey
  FOREIGN KEY (last_organization_id)
  REFERENCES auth.organizations(id)
  ON DELETE SET NULL;
`.trim();

const DOWN_SQL = `
ALTER TABLE auth.users
  DROP CONSTRAINT IF EXISTS users_last_organization_id_fkey;

ALTER TABLE auth.users
  DROP COLUMN IF EXISTS last_role,
  DROP COLUMN IF EXISTS last_organization_id;
`.trim();

/**
 * Migration 031 — remember the organization and role a user last confirmed.
 */
export class AddUserLastLoginContext0000000000031 implements MigrationInterface {
  name = 'AddUserLastLoginContext0000000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
