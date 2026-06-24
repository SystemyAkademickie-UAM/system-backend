import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShopDiscountsImprovements0000000000017 implements MigrationInterface {
  name = 'ShopDiscountsImprovements0000000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Create new promotion tables FIRST (before backfill) ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gamification.shop_listing_rank_promotions (
        id SERIAL PRIMARY KEY,
        shop_listing_id INT NOT NULL REFERENCES gamification.shop_listings(id) ON DELETE CASCADE,
        rank_id INT NOT NULL REFERENCES gamification.ranks(id) ON DELETE CASCADE,
        promotion_type VARCHAR(20) NOT NULL,
        value INT NOT NULL,
        CONSTRAINT shop_listing_rank_promotions_listing_rank_unique UNIQUE (shop_listing_id, rank_id),
        CONSTRAINT shop_listing_rank_promotions_type_check CHECK (promotion_type IN ('percent', 'fixed'))
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS shop_listing_rank_promotions_listing_id_idx ON gamification.shop_listing_rank_promotions (shop_listing_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS shop_listing_rank_promotions_rank_id_idx ON gamification.shop_listing_rank_promotions (rank_id);`);

    // --- Idempotent backfill from legacy tables (before DROP) ---

    // Backfill: shop_listing_rank_prices → shop_listing_rank_promotions (type=fixed)
    await queryRunner.query(`
      INSERT INTO gamification.shop_listing_rank_promotions (shop_listing_id, rank_id, promotion_type, value)
      SELECT listing_id, rank_id, 'fixed', price
      FROM gamification.shop_listing_rank_prices
      WHERE price IS NOT NULL AND price > 0
      ON CONFLICT (shop_listing_id, rank_id) DO NOTHING;
    `).catch(() => { /* table may not exist — safe to ignore */ });

    // Backfill: ranks.discount → global_discount_type/value (percent)
    await queryRunner.query(`
      UPDATE gamification.ranks
      SET global_discount_type = 'percent',
          global_discount_value = ROUND(discount)::int
      WHERE discount IS NOT NULL AND discount > 0
        AND global_discount_type IS NULL;
    `).catch(() => { /* column may not exist — safe to ignore */ });

    // Backfill: ranks.store_discount → global_discount_type/value (fixed, only if no percent was set)
    await queryRunner.query(`
      UPDATE gamification.ranks
      SET global_discount_type = 'fixed',
          global_discount_value = store_discount
      WHERE store_discount IS NOT NULL AND store_discount > 0
        AND global_discount_type IS NULL;
    `).catch(() => { /* column may not exist — safe to ignore */ });

    // --- Drop legacy tables/columns ---
    await queryRunner.query(`DROP INDEX IF EXISTS gamification.shop_listing_rank_prices_rank_id_idx;`);
    await queryRunner.query(`DROP INDEX IF EXISTS gamification.shop_listing_rank_prices_listing_id_idx;`);
    await queryRunner.query(`DROP TABLE IF EXISTS gamification.shop_listing_rank_prices;`);

    await queryRunner.query(`ALTER TABLE gamification.ranks DROP COLUMN IF EXISTS discount;`);
    await queryRunner.query(`ALTER TABLE gamification.ranks DROP COLUMN IF EXISTS store_discount;`);
    await queryRunner.query(`ALTER TABLE gamification.ranks ADD COLUMN IF NOT EXISTS global_discount_type VARCHAR(20);`);
    await queryRunner.query(`ALTER TABLE gamification.ranks ADD COLUMN IF NOT EXISTS global_discount_value INT DEFAULT 0;`);

    await queryRunner.query(`ALTER TABLE gamification.badges ADD COLUMN IF NOT EXISTS global_discount_type VARCHAR(20);`);
    await queryRunner.query(`ALTER TABLE gamification.badges ADD COLUMN IF NOT EXISTS global_discount_value INT DEFAULT 0;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE gamification.badges DROP COLUMN IF EXISTS global_discount_value;`);
    await queryRunner.query(`ALTER TABLE gamification.badges DROP COLUMN IF EXISTS global_discount_type;`);
    await queryRunner.query(`ALTER TABLE gamification.ranks DROP COLUMN IF EXISTS global_discount_value;`);
    await queryRunner.query(`ALTER TABLE gamification.ranks DROP COLUMN IF EXISTS global_discount_type;`);
    await queryRunner.query(`ALTER TABLE gamification.ranks ADD COLUMN IF NOT EXISTS store_discount INT DEFAULT 0;`);
    await queryRunner.query(`ALTER TABLE gamification.ranks ADD COLUMN IF NOT EXISTS discount DECIMAL(5,2) DEFAULT 0;`);
    await queryRunner.query(`DROP TABLE IF EXISTS gamification.shop_listing_rank_promotions CASCADE;`);
  }
}

