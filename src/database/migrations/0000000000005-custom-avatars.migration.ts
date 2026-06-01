import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
INSERT INTO auth.avatars (id, image_url, name) VALUES
  (7, '/assets/avatars/astronaut_helmet.png', 'Astronaut Helmet'),
  (8, '/assets/avatars/blue_wizard.png', 'Blue Wizard'),
  (9, '/assets/avatars/carrot_radar.png', 'Carrot Radar'),
  (10, '/assets/avatars/desert_cactus.png', 'Desert Cactus'),
  (11, '/assets/avatars/egyptian_pharaoh.png', 'Egyptian Pharaoh'),
  (12, '/assets/avatars/fantasy_alchemist.png', 'Fantasy Alchemist'),
  (13, '/assets/avatars/fantasy_centaur.png', 'Fantasy Centaur'),
  (14, '/assets/avatars/fantasy_dragon.png', 'Fantasy Dragon'),
  (15, '/assets/avatars/fantasy_dwarf.png', 'Fantasy Dwarf'),
  (16, '/assets/avatars/fantasy_elf.png', 'Fantasy Elf'),
  (17, '/assets/avatars/fantasy_goblin.png', 'Fantasy Goblin'),
  (18, '/assets/avatars/fantasy_griffin.png', 'Fantasy Griffin'),
  (19, '/assets/avatars/fantasy_knight.png', 'Fantasy Knight'),
  (20, '/assets/avatars/fantasy_mage.png', 'Fantasy Mage'),
  (21, '/assets/avatars/fantasy_necromancer.png', 'Fantasy Necromancer'),
  (22, '/assets/avatars/fantasy_orc.png', 'Fantasy Orc'),
  (23, '/assets/avatars/fantasy_portal.png', 'Fantasy Portal'),
  (24, '/assets/avatars/fantasy_sword.png', 'Fantasy Sword'),
  (25, '/assets/avatars/fantasy_treasure.png', 'Fantasy Treasure'),
  (26, '/assets/avatars/fantasy_viking.png', 'Fantasy Viking'),
  (27, '/assets/avatars/green_alien.png', 'Green Alien'),
  (28, '/assets/avatars/green_chameleon.png', 'Green Chameleon'),
  (29, '/assets/avatars/man_glasses.png', 'Man Glasses'),
  (30, '/assets/avatars/man_guitar.png', 'Man Guitar'),
  (31, '/assets/avatars/man_headphones.png', 'Man Headphones'),
  (32, '/assets/avatars/man_hiker.png', 'Man Hiker'),
  (33, '/assets/avatars/man_laptop.png', 'Man Laptop'),
  (34, '/assets/avatars/nobodgeit.png', 'Nobodgeit'),
  (35, '/assets/avatars/panda_eating.png', 'Panda Eating'),
  (36, '/assets/avatars/panda_leaf.png', 'Panda Leaf'),
  (37, '/assets/avatars/pizza_slice.png', 'Pizza Slice'),
  (38, '/assets/avatars/rabbit_blackhole.png', 'Rabbit Blackhole'),
  (39, '/assets/avatars/rabbit_mechanic.png', 'Rabbit Mechanic'),
  (40, '/assets/avatars/rabbit_nebula.png', 'Rabbit Nebula'),
  (41, '/assets/avatars/rabbit_rocket.png', 'Rabbit Rocket'),
  (42, '/assets/avatars/rabbit_rover.png', 'Rabbit Rover'),
  (43, '/assets/avatars/rabbit_satellite.png', 'Rabbit Satellite'),
  (44, '/assets/avatars/rabbit_spacestation.png', 'Rabbit Spacestation'),
  (45, '/assets/avatars/retro_rocket.png', 'Retro Rocket'),
  (46, '/assets/avatars/senior_woman.png', 'Senior Woman'),
  (47, '/assets/avatars/space_carrots.png', 'Space Carrots'),
  (48, '/assets/avatars/steampunk_airship.png', 'Steampunk Airship'),
  (49, '/assets/avatars/steampunk_binoculars.png', 'Steampunk Binoculars'),
  (50, '/assets/avatars/steampunk_clock.png', 'Steampunk Clock'),
  (51, '/assets/avatars/steampunk_gears.png', 'Steampunk Gears'),
  (52, '/assets/avatars/steampunk_gentleman.png', 'Steampunk Gentleman'),
  (53, '/assets/avatars/steampunk_king.png', 'Steampunk King'),
  (54, '/assets/avatars/steampunk_machine.png', 'Steampunk Machine'),
  (55, '/assets/avatars/steampunk_orrery.png', 'Steampunk Orrery'),
  (56, '/assets/avatars/steampunk_rabbit.png', 'Steampunk Rabbit'),
  (57, '/assets/avatars/tiger_face.png', 'Tiger Face'),
  (58, '/assets/avatars/ufo_alien.png', 'Ufo Alien'),
  (59, '/assets/avatars/vinyl_player.png', 'Vinyl Player'),
  (60, '/assets/avatars/vinyl_record.png', 'Vinyl Record'),
  (61, '/assets/avatars/woman_beach.png', 'Woman Beach'),
  (62, '/assets/avatars/woman_curly.png', 'Woman Curly'),
  (63, '/assets/avatars/woman_glasses.png', 'Woman Glasses'),
  (64, '/assets/avatars/woman_hijab.png', 'Woman Hijab'),
  (65, '/assets/avatars/woman_reading.png', 'Woman Reading'),
  (66, '/assets/avatars/woman_smiling.png', 'Woman Smiling')
ON CONFLICT (id) DO UPDATE SET image_url = EXCLUDED.image_url, name = EXCLUDED.name;
`.trim();

const DOWN_SQL = `
DELETE FROM auth.avatars WHERE id IN (7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66);
`.trim();

export class CustomAvatars0000000000005 implements MigrationInterface {
  name = 'CustomAvatars0000000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
