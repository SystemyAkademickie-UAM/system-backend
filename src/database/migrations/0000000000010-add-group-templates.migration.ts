import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
CREATE TABLE IF NOT EXISTS education.group_templates (
  id SERIAL NOT NULL,
  name character varying NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  creator_account_id integer NOT NULL,
  base_group_id integer,
  data jsonb NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_group_templates_id" PRIMARY KEY (id)
);
`.trim();

const DOWN_SQL = `
DROP TABLE IF EXISTS education.group_templates;
`.trim();

export class addGroupTemplates0000000000010 implements MigrationInterface {
  name = 'addGroupTemplates0000000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
