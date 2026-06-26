import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = `
CREATE TABLE IF NOT EXISTS education.group_template_favorites (
  id SERIAL NOT NULL,
  account_id integer NOT NULL,
  template_id integer NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_group_template_favorites_id" PRIMARY KEY (id),
  CONSTRAINT "UQ_group_template_favorites_account_template" UNIQUE (account_id, template_id),
  CONSTRAINT "FK_group_template_favorites_template"
    FOREIGN KEY (template_id) REFERENCES education.group_templates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS group_template_favorites_account_id_idx
  ON education.group_template_favorites (account_id);
`.trim();

const DOWN_SQL = `
DROP TABLE IF EXISTS education.group_template_favorites;
`.trim();

export class AddGroupTemplateFavorites0000000000022 implements MigrationInterface {
  name = 'AddGroupTemplateFavorites0000000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
