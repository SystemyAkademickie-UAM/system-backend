import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
CREATE TABLE IF NOT EXISTS services.system_documents (
  id serial PRIMARY KEY,
  document_key character varying(64) NOT NULL UNIQUE,
  title character varying(200) NOT NULL,
  original_filename character varying(255) NOT NULL,
  storage_key character varying(128) NOT NULL,
  file_size_bytes integer NOT NULL CHECK (file_size_bytes > 0),
  uploaded_by_user_id integer DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT system_documents_key_check CHECK (
    document_key IN ('termsOfUse', 'privacyPolicy', 'documentation')
  )
);
`.trim();

const DOWN_SQL = `
DROP TABLE IF EXISTS services.system_documents;
`.trim();

/**
 * Migration 033 — managed application PDF documents table (`services.system_documents`).
 */
export class SystemDocuments0000000000033 implements MigrationInterface {
  name = 'SystemDocuments0000000000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}

