import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
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
`.trim();

const DOWN_SQL = `
DROP INDEX IF EXISTS item_category_links_category_id_idx;
DROP TABLE IF EXISTS gamification.item_category_links;
`.trim();

export class AddItemCategoryLinks0000000000025 implements MigrationInterface {
  name = 'AddItemCategoryLinks0000000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
