import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRegistrationColumns1748201000000 implements MigrationInterface {
  name = 'AddUserRegistrationColumns1748201000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE auth.users
      ADD COLUMN IF NOT EXISTS registration_completed boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE auth.users
      ADD COLUMN IF NOT EXISTS eula_accepted_at timestamp without time zone DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE auth.users
      DROP COLUMN IF EXISTS eula_accepted_at
    `);
    await queryRunner.query(`
      ALTER TABLE auth.users
      DROP COLUMN IF EXISTS registration_completed
    `);
  }
}
