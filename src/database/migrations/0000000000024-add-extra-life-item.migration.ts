import type { MigrationInterface, QueryRunner } from 'typeorm';

import {
  EXTRA_LIFE_DEFAULT_BASE_PRICE,
  EXTRA_LIFE_DEFAULT_EDUCATIONAL_DESCRIPTION,
  EXTRA_LIFE_DEFAULT_STORY_DESCRIPTION,
  EXTRA_LIFE_ITEM_NAME,
} from '../../constants/extra-life-constants';

const UP_SQL = `
ALTER TABLE gamification.items
  ADD COLUMN IF NOT EXISTS is_extra_life boolean NOT NULL DEFAULT false;
`.trim();

const DOWN_SQL = `
ALTER TABLE gamification.items DROP COLUMN IF EXISTS is_extra_life;
`.trim();

/**
 * Adds the `is_extra_life` flag and backfills the default extra-life product for existing groups.
 */
export class AddExtraLifeItem0000000000024 implements MigrationInterface {
  name = 'AddExtraLifeItem0000000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);

    const groupsMissingExtraLife = await queryRunner.query(
      `
      SELECT g.id
      FROM education.groups g
      WHERE NOT EXISTS (
        SELECT 1
        FROM gamification.items i
        WHERE i.group_id = g.id
          AND i.is_extra_life = true
      )
      `,
    ) as Array<{ id: number }>;

    for (const group of groupsMissingExtraLife) {
      const insertedItems = await queryRunner.query(
        `
        INSERT INTO gamification.items (
          group_id,
          category_id,
          image_ref,
          name,
          story_description,
          educational_description,
          is_published,
          is_extra_life
        )
        VALUES ($1, NULL, NULL, $2, $3, $4, true, true)
        RETURNING id
        `,
        [
          group.id,
          EXTRA_LIFE_ITEM_NAME,
          EXTRA_LIFE_DEFAULT_STORY_DESCRIPTION,
          EXTRA_LIFE_DEFAULT_EDUCATIONAL_DESCRIPTION,
        ],
      ) as Array<{ id: number }>;

      const itemId = insertedItems[0]?.id;
      if (!itemId) {
        continue;
      }

      await queryRunner.query(
        `
        INSERT INTO gamification.shop_listings (item_id, base_price, stock_quantity, per_student_limit)
        VALUES ($1, $2, NULL, NULL)
        `,
        [itemId, EXTRA_LIFE_DEFAULT_BASE_PRICE],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
