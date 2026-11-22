import type { MigrationInterface, QueryRunner } from 'typeorm';

import {
  ORGANIZATION_DEFAULT_STORAGE_QUOTA_BYTES,
  SERVER_TOTAL_STORAGE_POOL_BYTES,
} from '../../constants/organization-storage-constants';

/**
 * Migration 037 — storage quota in bytes on each organization.
 */
export class OrganizationStorageQuota0000000000037 implements MigrationInterface {
  name = 'OrganizationStorageQuota0000000000037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        ADD COLUMN IF NOT EXISTS storage_quota_bytes bigint
    `);
    await queryRunner.query(`
      UPDATE auth.organizations
        SET storage_quota_bytes = ${ORGANIZATION_DEFAULT_STORAGE_QUOTA_BYTES}
        WHERE storage_quota_bytes IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        ALTER COLUMN storage_quota_bytes SET DEFAULT ${ORGANIZATION_DEFAULT_STORAGE_QUOTA_BYTES}
    `);
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        ALTER COLUMN storage_quota_bytes SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        DROP CONSTRAINT IF EXISTS organizations_storage_quota_bytes_check
    `);
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        ADD CONSTRAINT organizations_storage_quota_bytes_check
        CHECK (storage_quota_bytes >= 1048576 AND storage_quota_bytes <= ${SERVER_TOTAL_STORAGE_POOL_BYTES})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        DROP CONSTRAINT IF EXISTS organizations_storage_quota_bytes_check
    `);
    await queryRunner.query(`
      ALTER TABLE auth.organizations
        DROP COLUMN IF EXISTS storage_quota_bytes
    `);
  }
}
