import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE "education"."groups"
  ADD COLUMN IF NOT EXISTS "lives_enabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "education"."groups"
  ADD COLUMN IF NOT EXISTS "lives_label" character varying(100) DEFAULT NULL;

ALTER TABLE "education"."groups"
  ADD COLUMN IF NOT EXISTS "lives_shop_enabled" boolean NOT NULL DEFAULT false;
`;

const DOWN_SQL = `
ALTER TABLE "education"."groups" DROP COLUMN IF EXISTS "lives_shop_enabled";
ALTER TABLE "education"."groups" DROP COLUMN IF EXISTS "lives_label";
ALTER TABLE "education"."groups" DROP COLUMN IF EXISTS "lives_enabled";
`;

/**
 * Migration adding the lives system configuration columns to `education.groups`.
 *
 * - `lives_enabled`      – master toggle for the lives system (default off).
 * - `lives_label`        – custom display name for lives (e.g. "Tarcze", "Serca").
 * - `lives_shop_enabled` – whether "extra life" appears as a shop product.
 *
 * Pre-existing columns `lives` (integer, default 3) and `lives_icon` (varchar)
 * are left untouched.
 */
export class LivesSystem0000000000010 implements MigrationInterface {
  name = 'LivesSystem0000000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
