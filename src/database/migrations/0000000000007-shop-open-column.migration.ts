import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShopOpenColumn0000000000007 implements MigrationInterface {
  name = 'ShopOpenColumn0000000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "education"."groups" ADD "shop_open" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "education"."groups" DROP COLUMN "shop_open"`);
  }
}
