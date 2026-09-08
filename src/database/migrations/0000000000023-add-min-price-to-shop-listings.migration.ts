import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
ALTER TABLE gamification.shop_listings
  ADD COLUMN IF NOT EXISTS min_price INTEGER NOT NULL DEFAULT 0;
`.trim();

const DOWN_SQL = `
ALTER TABLE gamification.shop_listings
  DROP COLUMN IF EXISTS min_price;
`.trim();

/**
 * Dodanie minimalnej ceny (min_price) do ofert sklepowych (shop_listings).
 */
export class AddMinPriceToShopListings0000000000023 implements MigrationInterface {
  name = 'AddMinPriceToShopListings0000000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
