import type { MigrationInterface, QueryRunner } from 'typeorm';

import { MAINTENANCE_MODE_SINGLETON_ID } from '../../constants/maintenance-constants';

const UP_SQL = `
CREATE TABLE IF NOT EXISTS services.maintenance_mode (
  id integer PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT false,
  message character varying(1000) DEFAULT NULL,
  estimated_end_at timestamp with time zone DEFAULT NULL,
  updated_by_user_id integer DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT maintenance_mode_singleton_check CHECK (id = ${MAINTENANCE_MODE_SINGLETON_ID})
);

INSERT INTO services.maintenance_mode (id, is_enabled)
VALUES (${MAINTENANCE_MODE_SINGLETON_ID}, false)
ON CONFLICT (id) DO NOTHING;
`.trim();

const DOWN_SQL = `
DROP TABLE IF EXISTS services.maintenance_mode;
`.trim();

/**
 * Migration 028 — singleton maintenance-mode configuration for the technical break trigger.
 */
export class MaintenanceMode0000000000028 implements MigrationInterface {
  name = 'MaintenanceMode0000000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
