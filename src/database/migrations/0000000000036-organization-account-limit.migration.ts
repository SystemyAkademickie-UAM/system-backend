import type { MigrationInterface, QueryRunner } from 'typeorm';

import { ORGANIZATION_ACCOUNT_LIMIT_DEFAULT } from '../../constants/organization-constants';

/**
 * Migration 036 — account limit on each organization.
 */
export class OrganizationAccountLimit0000000000036 implements MigrationInterface {
  name = 'OrganizationAccountLimit0000000000036';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        ADD COLUMN IF NOT EXISTS account_limit integer
    `);
    await queryRunner.query(`
      UPDATE auth.organizations
        SET account_limit = ${ORGANIZATION_ACCOUNT_LIMIT_DEFAULT}
        WHERE account_limit IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        ALTER COLUMN account_limit SET DEFAULT ${ORGANIZATION_ACCOUNT_LIMIT_DEFAULT}
    `);
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        ALTER COLUMN account_limit SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        DROP CONSTRAINT IF EXISTS organizations_account_limit_check
    `);
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        ADD CONSTRAINT organizations_account_limit_check
        CHECK (account_limit >= 1)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        DROP CONSTRAINT IF EXISTS organizations_account_limit_check
    `);
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        DROP COLUMN IF EXISTS account_limit
    `);
  }
}
