import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 002 — schema changes merged from main (post-baseline).
 * Idempotent: safe on fresh `maq.sql` loads and on older persisted databases.
 * Consolidates former timestamp migrations 1748201000000–1748204000000.
 */
const UP_SQL = `
ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS registration_completed boolean NOT NULL DEFAULT false;

ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS eula_accepted_at timestamp without time zone DEFAULT NULL;

CREATE TABLE IF NOT EXISTS auth.avatars (
  id integer NOT NULL,
  image_url character varying(255) NOT NULL,
  name character varying(100) NOT NULL,
  CONSTRAINT avatars_pkey PRIMARY KEY (id)
);

INSERT INTO auth.avatars (id, image_url, name) VALUES
  (1, 'https://api.dicebear.com/7.x/bottts/svg?seed=BlueRobot', 'Niebieski Robot'),
  (2, 'https://api.dicebear.com/7.x/bottts/svg?seed=GreenRobot', 'Zielony Robot'),
  (3, 'https://api.dicebear.com/7.x/bottts/svg?seed=RedGnom', 'Czerwony Gnom'),
  (4, 'https://api.dicebear.com/7.x/bottts/svg?seed=GoldenCat', 'Złoty Kot'),
  (5, 'https://api.dicebear.com/7.x/bottts/svg?seed=WiseOwl', 'Mądra Sowa'),
  (6, 'https://api.dicebear.com/7.x/bottts/svg?seed=AstroDog', 'Kosmiczny Pies')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS avatar_id integer NOT NULL DEFAULT 1;

ALTER TABLE gamification.badges
ADD COLUMN IF NOT EXISTS educational_description text;

ALTER TABLE gamification.badges
ADD COLUMN IF NOT EXISTS story_description text;

ALTER TABLE gamification.badges
ADD COLUMN IF NOT EXISTS reward_amount integer DEFAULT 0;

ALTER TABLE gamification.badges
ADD COLUMN IF NOT EXISTS icon character varying(255);

ALTER TABLE gamification.badges
ADD COLUMN IF NOT EXISTS rarity character varying(20) DEFAULT 'common' NOT NULL;

ALTER TABLE gamification.ranks
ADD COLUMN IF NOT EXISTS icon character varying(255);

ALTER TABLE gamification.ranks
ADD COLUMN IF NOT EXISTS story_description text;

ALTER TABLE gamification.ranks
ADD COLUMN IF NOT EXISTS store_discount integer DEFAULT 0;

ALTER TABLE gamification.ranks
ADD COLUMN IF NOT EXISTS unique_store_items text[];

ALTER TABLE gamification.student_stats
ADD COLUMN IF NOT EXISTS total_earned integer DEFAULT 0;

ALTER TABLE education.groups
ADD COLUMN IF NOT EXISTS currency_icon character varying(255);

ALTER TABLE education.groups
ADD COLUMN IF NOT EXISTS lives_icon character varying(255);

ALTER TABLE education.groups
ADD COLUMN IF NOT EXISTS subject_name character varying(255) NULL;
`.trim();

const DOWN_SQL = `
ALTER TABLE education.groups DROP COLUMN IF EXISTS subject_name;
ALTER TABLE education.groups DROP COLUMN IF EXISTS lives_icon;
ALTER TABLE education.groups DROP COLUMN IF EXISTS currency_icon;
ALTER TABLE gamification.student_stats DROP COLUMN IF EXISTS total_earned;
ALTER TABLE gamification.ranks DROP COLUMN IF EXISTS unique_store_items;
ALTER TABLE gamification.ranks DROP COLUMN IF EXISTS store_discount;
ALTER TABLE gamification.ranks DROP COLUMN IF EXISTS story_description;
ALTER TABLE gamification.ranks DROP COLUMN IF EXISTS icon;
ALTER TABLE gamification.badges DROP COLUMN IF EXISTS rarity;
ALTER TABLE gamification.badges DROP COLUMN IF EXISTS icon;
ALTER TABLE gamification.badges DROP COLUMN IF EXISTS reward_amount;
ALTER TABLE gamification.badges DROP COLUMN IF EXISTS story_description;
ALTER TABLE gamification.badges DROP COLUMN IF EXISTS educational_description;
ALTER TABLE auth.users DROP COLUMN IF EXISTS eula_accepted_at;
ALTER TABLE auth.users DROP COLUMN IF EXISTS registration_completed;
`.trim();

export class MainSchemaSync0000000000002 implements MigrationInterface {
  name = 'MainSchemaSync0000000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
