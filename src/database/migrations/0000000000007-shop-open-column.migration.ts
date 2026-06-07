import { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `ALTER TABLE "education"."groups" ADD COLUMN IF NOT EXISTS "shop_open" boolean NOT NULL DEFAULT true`;
const DOWN_SQL = `ALTER TABLE "education"."groups" DROP COLUMN IF EXISTS "shop_open"`;

/**
 * Migration adding the shop_open column.
 */
export class ShopOpenColumn0000000000007 implements MigrationInterface {
  name = 'ShopOpenColumn0000000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
