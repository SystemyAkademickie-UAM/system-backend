import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
CREATE TABLE IF NOT EXISTS analytics.organization_log (
  id serial PRIMARY KEY,
  organization_id integer NOT NULL REFERENCES auth.organizations(id) ON DELETE CASCADE,
  category character varying(32) NOT NULL,
  kind character varying(64) NOT NULL,
  occurred_at timestamp with time zone NOT NULL DEFAULT NOW(),
  actor_user_id integer,
  actor_name character varying(255) NOT NULL DEFAULT '',
  subject_account_id integer,
  subject_name character varying(255) NOT NULL DEFAULT '',
  group_id integer,
  group_name character varying(255) NOT NULL DEFAULT '',
  role_name character varying(32),
  file_kind character varying(16),
  file_name character varying(255),
  file_size_bytes integer,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT organization_log_category_check CHECK (category IN ('organization', 'group')),
  CONSTRAINT organization_log_file_size_check CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_organization_log_org_time
  ON analytics.organization_log (organization_id, occurred_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_organization_log_org_category_time
  ON analytics.organization_log (organization_id, category, occurred_at DESC, id DESC);
`.trim();

const DOWN_SQL = `
DROP INDEX IF EXISTS analytics.idx_organization_log_org_category_time;
DROP INDEX IF EXISTS analytics.idx_organization_log_org_time;
DROP TABLE IF EXISTS analytics.organization_log;
`.trim();

/**
 * Migration 035 — durable organization administrator log (`analytics.organization_log`).
 */
export class OrganizationLog0000000000035 implements MigrationInterface {
  name = 'OrganizationLog0000000000035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
