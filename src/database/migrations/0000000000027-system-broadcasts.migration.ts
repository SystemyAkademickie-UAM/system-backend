import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
CREATE TABLE IF NOT EXISTS services.broadcasts (
  id serial PRIMARY KEY,
  title character varying(200) NOT NULL,
  content text NOT NULL,
  level character varying(16) NOT NULL DEFAULT 'info',
  target_role character varying(32) NOT NULL DEFAULT 'all',
  expires_at timestamp with time zone DEFAULT NULL,
  created_by_user_id integer DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT broadcasts_level_check CHECK (level IN ('info', 'warning', 'critical')),
  CONSTRAINT broadcasts_target_role_check CHECK (target_role IN ('all', 'student', 'lecturer', 'administrator'))
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_target_expires
  ON services.broadcasts (target_role, expires_at);

CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at
  ON services.broadcasts (created_at DESC);

CREATE TABLE IF NOT EXISTS services.user_broadcast_status (
  user_id integer NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broadcast_id integer NOT NULL REFERENCES services.broadcasts(id) ON DELETE CASCADE,
  read_at timestamp with time zone NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, broadcast_id)
);

CREATE INDEX IF NOT EXISTS idx_user_broadcast_status_broadcast
  ON services.user_broadcast_status (broadcast_id);
`.trim();

const DOWN_SQL = `
DROP INDEX IF EXISTS services.idx_user_broadcast_status_broadcast;
DROP TABLE IF EXISTS services.user_broadcast_status;
DROP INDEX IF EXISTS services.idx_broadcasts_created_at;
DROP INDEX IF EXISTS services.idx_broadcasts_target_expires;
DROP TABLE IF EXISTS services.broadcasts;
`.trim();

/**
 * Migration 027 — system-wide broadcasts (pull model with per-user read receipts).
 */
export class SystemBroadcasts0000000000027 implements MigrationInterface {
  name = 'SystemBroadcasts0000000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
