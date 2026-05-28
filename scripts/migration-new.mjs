#!/usr/bin/env node
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'src', 'database', 'migrations');
const MIGRATION_FILE_PATTERN = /^(\d{13})-(.+)\.migration\.ts$/;

function toPascalCase(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function resolveNextMigrationTimestamp() {
  const files = readdirSync(MIGRATIONS_DIR);
  let maxTimestamp = 0;
  for (const file of files) {
    const match = file.match(MIGRATION_FILE_PATTERN);
    if (!match) {
      continue;
    }
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > maxTimestamp) {
      maxTimestamp = parsed;
    }
  }
  return String(maxTimestamp + 1).padStart(13, '0');
}

function buildMigrationFileContent(timestamp, slug) {
  const className = `${toPascalCase(slug)}${timestamp}`;
  return `import type { MigrationInterface, QueryRunner } from 'typeorm';

const UP_SQL = \`
-- TODO: forward migration SQL
\`.trim();

const DOWN_SQL = \`
-- TODO: rollback SQL
\`.trim();

export class ${className} implements MigrationInterface {
  name = '${className}';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
`;
}

const slug = process.argv[2]?.trim();
if (!slug) {
  console.error('Usage: npm run migration:new -- <slug>');
  console.error('Example: npm run migration:new -- add-user-nickname');
  process.exit(1);
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('Slug must be kebab-case (lowercase letters, digits, hyphens).');
  process.exit(1);
}

const timestamp = resolveNextMigrationTimestamp();
const fileName = `${timestamp}-${slug}.migration.ts`;
const filePath = join(MIGRATIONS_DIR, fileName);

writeFileSync(filePath, buildMigrationFileContent(timestamp, slug), 'utf8');
console.log(`Created ${filePath}`);
