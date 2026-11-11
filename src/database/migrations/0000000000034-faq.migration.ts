import type { MigrationInterface, QueryRunner } from 'typeorm';

import { DEFAULT_FAQ_SEED_ITEMS } from '../../constants/faq-constants';

const UP_SQL = `
CREATE TABLE IF NOT EXISTS services.faqs (
  id serial PRIMARY KEY,
  question character varying(300) NOT NULL,
  answer text NOT NULL,
  category character varying(100) NOT NULL DEFAULT 'Ogólne',
  order_index integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_by_user_id integer DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_user_id integer DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  updated_at timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_category_order
  ON services.faqs (category, order_index ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_faqs_published
  ON services.faqs (is_published);
`.trim();

const INSERT_SEED_SQL = `
INSERT INTO services.faqs (question, answer, category, order_index, is_published)
VALUES ($1, $2, $3, $4, true);
`.trim();

const DOWN_SQL = `
DROP INDEX IF EXISTS services.idx_faqs_published;
DROP INDEX IF EXISTS services.idx_faqs_category_order;
DROP TABLE IF EXISTS services.faqs;
`.trim();

/**
 * Migration 034 — FAQ knowledge base entries table (`services.faqs`) and initial seed data.
 */
export class Faq0000000000034 implements MigrationInterface {
  name = 'Faq0000000000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
    const existingRows = (await queryRunner.query(
      'SELECT COUNT(*)::int AS count FROM services.faqs',
    )) as Array<{ count: number }>;
    if ((existingRows[0]?.count ?? 0) === 0) {
      for (const item of DEFAULT_FAQ_SEED_ITEMS) {
        await queryRunner.query(INSERT_SEED_SQL, [
          item.question,
          item.answer,
          item.category,
          item.orderIndex,
        ]);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
