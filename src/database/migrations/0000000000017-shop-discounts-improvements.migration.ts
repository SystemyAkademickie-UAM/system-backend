import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShopDiscountsImprovements0000000000015 implements MigrationInterface {
  name = 'ShopDiscountsImprovements0000000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS gamification.shop_listing_rank_prices_rank_id_idx;`);
    await queryRunner.query(`DROP INDEX IF EXISTS gamification.shop_listing_rank_prices_listing_id_idx;`);
    await queryRunner.query(`DROP TABLE IF EXISTS gamification.shop_listing_rank_prices;`);

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
