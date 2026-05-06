import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Core tables for opaque API tokens (`token_hmac`), users, RBAC roles, and course groups.
 *
 * If `auth_tokens` still carries a legacy plaintext `token` column, drops that table — stored values are not migrating to digests server-side — then recreates `auth_tokens` with HMAC-aware columns (re-issue tokens via `POST /api/login`).
 */
export class MaqCoreSchema1739107200000 implements MigrationInterface {
  name = 'MaqCoreSchema1739107200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL NOT NULL,
  "email" character varying(256),
  "saml_name_id" character varying(512),
  CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_users_saml_name_id" UNIQUE ("saml_name_id")
)`);
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS "groups" (
  "id" SERIAL NOT NULL,
  "name" character varying(256) NOT NULL,
  "description" text NOT NULL,
  "currency" character varying(128) NOT NULL,
  "currency_icon" integer NOT NULL,
  "life" character varying(128) NOT NULL,
  "life_icon" integer NOT NULL,
  "banner_ref" character varying(128),
  "created_by_user_id" integer,
  CONSTRAINT "PK_groups_id" PRIMARY KEY ("id")
)`);
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" SERIAL NOT NULL,
  "user_id" integer NOT NULL,
  "role" character varying(64) NOT NULL,
  CONSTRAINT "PK_user_roles_id" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_user_roles_user_id_role" UNIQUE ("user_id", "role")
)`);
    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS "IDX_user_roles_user_id"
ON "user_roles" ("user_id")`);
    await queryRunner.query(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'auth_tokens'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'auth_tokens' AND column_name = 'token'
  ) THEN
    EXECUTE 'DROP TABLE IF EXISTS "auth_tokens" CASCADE';
  END IF;
END $$`);
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS "auth_tokens" (
  "id" SERIAL NOT NULL,
  "token_hmac" character varying(64) NOT NULL,
  "browser_uuid" character varying(64) NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT "PK_auth_tokens_id" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_auth_tokens_token_hmac" UNIQUE ("token_hmac"),
  CONSTRAINT "FK_auth_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_tokens" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_roles" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "groups" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
  }
}
