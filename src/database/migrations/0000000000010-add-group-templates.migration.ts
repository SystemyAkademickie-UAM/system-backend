import { MigrationInterface, QueryRunner } from 'typeorm';

export class addGroupTemplates0000000000010 implements MigrationInterface {
  name = 'addGroupTemplates0000000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "education"."group_templates" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" text, "is_public" boolean NOT NULL DEFAULT false, "creator_account_id" integer NOT NULL, "base_group_id" integer, "data" jsonb NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_group_templates_id" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "education"."group_templates"`);
  }
}
