import type { MigrationInterface, QueryRunner } from 'typeorm';

import {
  ORGANIZATION_LOGIN_METHOD_INTERNAL,
  ORGANIZATION_LOGIN_METHOD_SAML,
  ORGANIZATIONS_ID_SEQUENCE,
  PRIVATE_ORGANIZATION_ID,
  PRIVATE_ORGANIZATION_NAME,
} from '../../constants/organization-constants';

const UP_SQL = `
ALTER TABLE auth.organizations
  ADD COLUMN IF NOT EXISTS login_method character varying(16) NOT NULL DEFAULT '${ORGANIZATION_LOGIN_METHOD_SAML}';

INSERT INTO auth.organizations (id, name, login_method, is_active, created_at, updated_at)
SELECT ${PRIVATE_ORGANIZATION_ID}, '${PRIVATE_ORGANIZATION_NAME}', '${ORGANIZATION_LOGIN_METHOD_INTERNAL}', true, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.organizations WHERE id = ${PRIVATE_ORGANIZATION_ID}
);

UPDATE auth.organizations
SET name = '${PRIVATE_ORGANIZATION_NAME}',
    login_method = '${ORGANIZATION_LOGIN_METHOD_INTERNAL}',
    updated_at = NOW()
WHERE id = ${PRIVATE_ORGANIZATION_ID};

UPDATE auth.organizations
SET login_method = '${ORGANIZATION_LOGIN_METHOD_SAML}'
WHERE id <> ${PRIVATE_ORGANIZATION_ID}
  AND sso_login_url IS NOT NULL
  AND TRIM(sso_login_url) <> ''
  AND certificate_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth.magic_link_tokens (
  id serial PRIMARY KEY,
  email character varying(255) NOT NULL,
  organization_id integer NOT NULL REFERENCES auth.organizations(id),
  token_hmac character varying(64) NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS magic_link_tokens_token_hmac_key
  ON auth.magic_link_tokens (token_hmac);

CREATE INDEX IF NOT EXISTS magic_link_tokens_org_email_created_at_idx
  ON auth.magic_link_tokens (organization_id, email, created_at DESC);

CREATE TABLE IF NOT EXISTS auth.sessions (
  id serial PRIMARY KEY,
  session_hmac character varying(64) NOT NULL,
  user_id integer NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL,
  expired_at timestamp with time zone NOT NULL,
  login_method character varying(32) NOT NULL,
  active_role character varying(32) DEFAULT NULL,
  organization_id integer DEFAULT NULL,
  saml_name_id character varying(512) DEFAULT NULL,
  saml_name_id_format character varying(256) DEFAULT NULL,
  saml_session_index character varying(256) DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sessions_session_hmac_key ON auth.sessions (session_hmac);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON auth.sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expired_at_idx ON auth.sessions (expired_at);

DROP TABLE IF EXISTS auth.tokens;

SELECT setval(
  '${ORGANIZATIONS_ID_SEQUENCE}',
  GREATEST((SELECT COALESCE(MAX(id), ${PRIVATE_ORGANIZATION_ID}) FROM auth.organizations), ${PRIVATE_ORGANIZATION_ID})
);

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS profile_submitted_at timestamp with time zone DEFAULT NULL;
`.trim();

const DOWN_SQL = `
ALTER TABLE auth.users DROP COLUMN IF EXISTS profile_submitted_at;

DROP TABLE IF EXISTS auth.sessions;

CREATE TABLE IF NOT EXISTS auth.tokens (
  id serial PRIMARY KEY,
  token_hmac character varying(256) NOT NULL,
  browser_uuid uuid NOT NULL,
  user_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL,
  expired_at timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS tokens_token_hmac_key ON auth.tokens (token_hmac);

DROP INDEX IF EXISTS auth.magic_link_tokens_org_email_created_at_idx;
DROP INDEX IF EXISTS auth.magic_link_tokens_token_hmac_key;
DROP TABLE IF EXISTS auth.magic_link_tokens;

DELETE FROM auth.organizations
WHERE id = ${PRIVATE_ORGANIZATION_ID}
  AND NOT EXISTS (SELECT 1 FROM auth.accounts WHERE organization_id = ${PRIVATE_ORGANIZATION_ID});

ALTER TABLE auth.organizations
  DROP COLUMN IF EXISTS login_method;
`.trim();

/**
 * Migration 016 — tenant login_method on auth.organizations, org-scoped magic links,
 * auth.sessions (replaces auth.tokens; no X-Browser-ID binding), and profile_submitted_at
 * on auth.users for registration wizard resume.
 * Ids 2–10 reserved for dev/test SAML; production tenants start at 11 (`register:org --production`).
 */
export class MagicLinkTokens0000000000016 implements MigrationInterface {
  name = 'MagicLinkTokens0000000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
