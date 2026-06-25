import { QueryFailedError, type MigrationInterface, type QueryRunner } from 'typeorm';

const POSTGRES_UNDEFINED_TABLE = '42P01';
const POSTGRES_UNDEFINED_COLUMN = '42703';

const CREATE_RANK_PROMOTIONS_SQL = `
CREATE TABLE IF NOT EXISTS gamification.shop_listing_rank_promotions (
  id SERIAL PRIMARY KEY,
  shop_listing_id INT NOT NULL REFERENCES gamification.shop_listings(id) ON DELETE CASCADE,
  rank_id INT NOT NULL REFERENCES gamification.ranks(id) ON DELETE CASCADE,
  promotion_type VARCHAR(20) NOT NULL,
  value INT NOT NULL,
  CONSTRAINT shop_listing_rank_promotions_listing_rank_unique UNIQUE (shop_listing_id, rank_id),
  CONSTRAINT shop_listing_rank_promotions_type_check CHECK (promotion_type IN ('percent', 'fixed'))
);
`;

const ADD_RANK_GLOBAL_DISCOUNT_COLUMNS_SQL = `
ALTER TABLE gamification.ranks ADD COLUMN IF NOT EXISTS global_discount_type VARCHAR(20);
ALTER TABLE gamification.ranks ADD COLUMN IF NOT EXISTS global_discount_value INT DEFAULT 0;
`;

const ADD_BADGE_GLOBAL_DISCOUNT_COLUMNS_SQL = `
ALTER TABLE gamification.badges ADD COLUMN IF NOT EXISTS global_discount_type VARCHAR(20);
ALTER TABLE gamification.badges ADD COLUMN IF NOT EXISTS global_discount_value INT DEFAULT 0;
`;

const BACKFILL_RANK_PRICES_SQL = `
INSERT INTO gamification.shop_listing_rank_promotions (shop_listing_id, rank_id, promotion_type, value)
SELECT
  srp.shop_listing_id,
  srp.rank_id,
  'fixed',
  GREATEST(0, sl.base_price - srp.price)
FROM gamification.shop_listing_rank_prices srp
INNER JOIN gamification.shop_listings sl ON sl.id = srp.shop_listing_id
WHERE srp.price IS NOT NULL
ON CONFLICT (shop_listing_id, rank_id) DO NOTHING;
`;

const BACKFILL_RANK_PERCENT_DISCOUNT_SQL = `
UPDATE gamification.ranks
SET global_discount_type = 'percent',
    global_discount_value = ROUND(discount)::int
WHERE discount IS NOT NULL AND discount > 0
  AND global_discount_type IS NULL;
`;

const BACKFILL_RANK_STORE_DISCOUNT_SQL = `
UPDATE gamification.ranks
SET global_discount_type = 'fixed',
    global_discount_value = store_discount
WHERE store_discount IS NOT NULL AND store_discount > 0
  AND global_discount_type IS NULL;
`;

const DROP_LEGACY_SQL = `
DROP INDEX IF EXISTS gamification.shop_listing_rank_prices_rank_id_idx;
DROP INDEX IF EXISTS gamification.shop_listing_rank_prices_listing_id_idx;
DROP TABLE IF EXISTS gamification.shop_listing_rank_prices;
ALTER TABLE gamification.ranks DROP COLUMN IF EXISTS discount;
ALTER TABLE gamification.ranks DROP COLUMN IF EXISTS store_discount;
`;

function isOptionalBackfillError(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) {
    return false;
  }
  const code = (err.driverError as { code?: string } | undefined)?.code;
  return code === POSTGRES_UNDEFINED_TABLE || code === POSTGRES_UNDEFINED_COLUMN;
}

async function runOptionalBackfill(queryRunner: QueryRunner, sql: string): Promise<void> {
  try {
    await queryRunner.query(sql);
  } catch (err: unknown) {
    if (!isOptionalBackfillError(err)) {
      throw err;
    }
  }
}

/**
 * Replaces legacy rank prices and rank discount columns with promotion tables and global discount fields.
 */
export class ShopDiscountsImprovements0000000000017 implements MigrationInterface {
  name = 'ShopDiscountsImprovements0000000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(CREATE_RANK_PROMOTIONS_SQL);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS shop_listing_rank_promotions_listing_id_idx ON gamification.shop_listing_rank_promotions (shop_listing_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS shop_listing_rank_promotions_rank_id_idx ON gamification.shop_listing_rank_promotions (rank_id);`,
    );

    await queryRunner.query(ADD_RANK_GLOBAL_DISCOUNT_COLUMNS_SQL);
    await queryRunner.query(ADD_BADGE_GLOBAL_DISCOUNT_COLUMNS_SQL);

    await runOptionalBackfill(queryRunner, BACKFILL_RANK_PRICES_SQL);
    await runOptionalBackfill(queryRunner, BACKFILL_RANK_PERCENT_DISCOUNT_SQL);
    await runOptionalBackfill(queryRunner, BACKFILL_RANK_STORE_DISCOUNT_SQL);

    await queryRunner.query(DROP_LEGACY_SQL);
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
