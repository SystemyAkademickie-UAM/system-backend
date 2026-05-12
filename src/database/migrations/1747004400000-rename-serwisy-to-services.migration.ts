import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames the `serwisy` schema to `services` for English consistency.
 * The `drive` table and all related sequences/constraints are moved automatically.
 */
export class RenameSerwisyToServices1747004400000 implements MigrationInterface {
  name = 'RenameSerwisyToServices1747004400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER SCHEMA serwisy RENAME TO services`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER SCHEMA services RENAME TO serwisy`);
  }
}
