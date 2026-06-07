import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
CREATE TABLE IF NOT EXISTS education.banners (
  id integer NOT NULL,
  image_url character varying(255) NOT NULL,
  name character varying(100) NOT NULL,
  CONSTRAINT banners_pkey PRIMARY KEY (id)
);

INSERT INTO education.banners (id, image_url, name) VALUES
  (1, '/assets/banners/cyberpunk.png', 'Cyberpunk'),
  (2, '/assets/banners/cybertech.png', 'Cybertech'),
  (3, '/assets/banners/dark_fantasy.png', 'Dark Fantasy'),
  (4, '/assets/banners/dragon.png', 'Dragon'),
  (5, '/assets/banners/dwarf_city.png', 'Dwarf City'),
  (6, '/assets/banners/fantasy.png', 'Fantasy'),
  (7, '/assets/banners/floating_island.png', 'Floating Island'),
  (8, '/assets/banners/forest.png', 'Forest'),
  (9, '/assets/banners/haunted_castle.png', 'Haunted Castle'),
  (10, '/assets/banners/magic_academy.png', 'Magic Academy'),
  (11, '/assets/banners/orcs_elves.png', 'Orcs Elves'),
  (12, '/assets/banners/rabbit_fantasy.png', 'Rabbit Fantasy'),
  (13, '/assets/banners/rabbit_steampunk.png', 'Rabbit Steampunk'),
  (14, '/assets/banners/scifi_base.png', 'Scifi Base'),
  (15, '/assets/banners/space.png', 'Space'),
  (16, '/assets/banners/space_rabbit.png', 'Space Rabbit'),
  (17, '/assets/banners/steampunk.png', 'Steampunk'),
  (18, '/assets/banners/underwater.png', 'Underwater')
ON CONFLICT (id) DO UPDATE SET image_url = EXCLUDED.image_url, name = EXCLUDED.name;
`.trim();

const DOWN_SQL = `
DROP TABLE IF EXISTS education.banners;
`.trim();

export class PredefinedBanners0000000000006 implements MigrationInterface {
  name = 'PredefinedBanners0000000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
