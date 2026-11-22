import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
CREATE TABLE IF NOT EXISTS services.patch_notes (
  id serial PRIMARY KEY,
  title character varying(200) NOT NULL,
  version character varying(64) DEFAULT NULL,
  original_filename character varying(255) NOT NULL,
  storage_key character varying(128) NOT NULL UNIQUE,
  file_size_bytes integer NOT NULL CHECK (file_size_bytes > 0),
  uploaded_by_user_id integer DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patch_notes_created_at
  ON services.patch_notes (created_at DESC, id DESC);
`.trim();

const DOWN_SQL = `
DROP INDEX IF EXISTS services.idx_patch_notes_created_at;
DROP TABLE IF EXISTS services.patch_notes;
`.trim();

/**
 * Migration 032 — patch notes PDF documents table (`services.patch_notes`).
 */
export class PatchNotes0000000000032 implements MigrationInterface {
  name = 'PatchNotes0000000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}

