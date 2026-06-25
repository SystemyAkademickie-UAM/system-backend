import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
  ALTER TABLE "education"."groups" ADD COLUMN IF NOT EXISTS "shop_opens_at" TIMESTAMP WITH TIME ZONE;
  ALTER TABLE "education"."groups" ADD COLUMN IF NOT EXISTS "rank_show_member_avatars" boolean NOT NULL DEFAULT true;
`.trim();

const DOWN_SQL = `
  ALTER TABLE "education"."groups" DROP COLUMN IF EXISTS "rank_show_member_avatars";
  ALTER TABLE "education"."groups" DROP COLUMN IF EXISTS "shop_opens_at";
`.trim();

export class AddShopOpensAtAndRankAvatars0000000000020 implements MigrationInterface {
  name = 'AddShopOpensAtAndRankAvatars0000000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
