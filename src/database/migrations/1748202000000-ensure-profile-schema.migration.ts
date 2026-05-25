import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Idempotent catch-up for databases created before db_v3.sql / TypeORM migrations
 * (e.g. persisted Docker volume with an older schema).
 */
export class EnsureProfileSchema1748202000000 implements MigrationInterface {
  name = 'EnsureProfileSchema1748202000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth.avatars (
        id integer NOT NULL,
        image_url character varying(255) NOT NULL,
        name character varying(100) NOT NULL,
        CONSTRAINT avatars_pkey PRIMARY KEY (id)
      )
    `);

    await queryRunner.query(`
      INSERT INTO auth.avatars (id, image_url, name) VALUES
      (1, 'https://api.dicebear.com/7.x/bottts/svg?seed=BlueRobot', 'Niebieski Robot'),
      (2, 'https://api.dicebear.com/7.x/bottts/svg?seed=GreenRobot', 'Zielony Robot'),
      (3, 'https://api.dicebear.com/7.x/bottts/svg?seed=RedGnom', 'Czerwony Gnom'),
      (4, 'https://api.dicebear.com/7.x/bottts/svg?seed=GoldenCat', 'Złoty Kot'),
      (5, 'https://api.dicebear.com/7.x/bottts/svg?seed=WiseOwl', 'Mądra Sowa'),
      (6, 'https://api.dicebear.com/7.x/bottts/svg?seed=AstroDog', 'Kosmiczny Pies')
      ON CONFLICT (id) DO NOTHING
    `);

    await queryRunner.query(`
      ALTER TABLE auth.users
      ADD COLUMN IF NOT EXISTS avatar_id integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      ALTER TABLE auth.users
      ADD COLUMN IF NOT EXISTS registration_completed boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE auth.users
      ADD COLUMN IF NOT EXISTS eula_accepted_at timestamp without time zone DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE gamification.badges
      ADD COLUMN IF NOT EXISTS rarity character varying(20) DEFAULT 'common' NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE gamification.student_stats
      ADD COLUMN IF NOT EXISTS total_earned integer DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE education.groups
      ADD COLUMN IF NOT EXISTS currency_icon character varying(255)
    `);

    await queryRunner.query(`
      ALTER TABLE education.groups
      ADD COLUMN IF NOT EXISTS lives_icon character varying(255)
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive catch-up migration — no down.
  }
}
