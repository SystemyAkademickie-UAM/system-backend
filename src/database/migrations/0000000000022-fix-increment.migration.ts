import type { MigrationInterface, QueryRunner } from 'typeorm';

import {
  EXTRA_LIFE_DEFAULT_BASE_PRICE,
  EXTRA_LIFE_DEFAULT_EDUCATIONAL_DESCRIPTION,
  EXTRA_LIFE_DEFAULT_STORY_DESCRIPTION,
  EXTRA_LIFE_ITEM_NAME,
} from '../../constants/extra-life-constants';

const UP_SQL = `
CREATE TABLE IF NOT EXISTS education.group_template_favorites (
  id SERIAL NOT NULL,
  account_id integer NOT NULL,
  template_id integer NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_group_template_favorites_id" PRIMARY KEY (id),
  CONSTRAINT "UQ_group_template_favorites_account_template" UNIQUE (account_id, template_id),
  CONSTRAINT "FK_group_template_favorites_template"
    FOREIGN KEY (template_id) REFERENCES education.group_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS group_template_favorites_account_id_idx
  ON education.group_template_favorites (account_id);

ALTER TABLE gamification.item_categories
  ADD COLUMN IF NOT EXISTS color varchar(32);

ALTER TABLE gamification.items
  ADD COLUMN IF NOT EXISTS is_extra_life boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS gamification.item_category_links (
  item_id integer NOT NULL,
  category_id integer NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, category_id),
  CONSTRAINT item_category_links_item_fk
    FOREIGN KEY (item_id) REFERENCES gamification.items(id) ON DELETE CASCADE,
  CONSTRAINT item_category_links_category_fk
    FOREIGN KEY (category_id) REFERENCES gamification.item_categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS item_category_links_category_id_idx
  ON gamification.item_category_links (category_id);

INSERT INTO gamification.item_category_links (item_id, category_id, display_order)
SELECT i.id, i.category_id, 0
FROM gamification.items i
WHERE i.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM gamification.item_category_links l
    WHERE l.item_id = i.id
      AND l.category_id = i.category_id
  );

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS show_nickname boolean NOT NULL DEFAULT true;
`.trim();

const DOWN_SQL = `
ALTER TABLE auth.users
  DROP COLUMN IF EXISTS show_nickname;

DROP INDEX IF EXISTS gamification.item_category_links_category_id_idx;
DROP TABLE IF EXISTS gamification.item_category_links;

ALTER TABLE gamification.items DROP COLUMN IF EXISTS is_extra_life;

ALTER TABLE gamification.item_categories DROP COLUMN IF EXISTS color;

DROP TABLE IF EXISTS education.group_template_favorites;
`.trim();

/**
 * Combined schema changes for template favorites, category colors/links, extra-life items, and profile nickname visibility.
 */
export class FixIncrement0000000000022 implements MigrationInterface {
  name = 'FixIncrement0000000000022';

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
