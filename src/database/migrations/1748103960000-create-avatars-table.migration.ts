import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAvatarsTable1748103960000 implements MigrationInterface {
  name = 'CreateAvatarsTable1748103960000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create avatars table
    await queryRunner.query(`
      CREATE TABLE auth.avatars (
        id integer NOT NULL,
        image_url character varying(255) NOT NULL,
        name character varying(100) NOT NULL,
        CONSTRAINT avatars_pkey PRIMARY KEY (id)
      )
    `);

    // 2. Insert default seeded avatars
    await queryRunner.query(`
      INSERT INTO auth.avatars (id, image_url, name) VALUES
      (1, 'https://api.dicebear.com/7.x/bottts/svg?seed=BlueRobot', 'Niebieski Robot'),
      (2, 'https://api.dicebear.com/7.x/bottts/svg?seed=GreenRobot', 'Zielony Robot'),
      (3, 'https://api.dicebear.com/7.x/bottts/svg?seed=RedGnom', 'Czerwony Gnom'),
      (4, 'https://api.dicebear.com/7.x/bottts/svg?seed=GoldenCat', 'Złoty Kot'),
      (5, 'https://api.dicebear.com/7.x/bottts/svg?seed=WiseOwl', 'Mądra Sowa'),
      (6, 'https://api.dicebear.com/7.x/bottts/svg?seed=AstroDog', 'Kosmiczny Pies')
    `);

    // 3. Update existing user rows to valid avatar ID if any are out of range
    await queryRunner.query(`
      UPDATE auth.users SET avatar_id = 1 WHERE avatar_id NOT IN (1, 2, 3, 4, 5, 6)
    `);

    // 4. Add foreign key to auth.users
    await queryRunner.query(`
      ALTER TABLE auth.users 
      ADD CONSTRAINT fk_users_avatar FOREIGN KEY (avatar_id) REFERENCES auth.avatars(id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE auth.users DROP CONSTRAINT IF EXISTS fk_users_avatar
    `);

    // Drop avatars table
    await queryRunner.query(`
      DROP TABLE auth.avatars
    `);
  }
}
