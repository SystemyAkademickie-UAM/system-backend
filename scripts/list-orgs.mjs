#!/usr/bin/env node
/**
 * Lists organization tenants from auth.organizations.
 *
 * Usage:
 *   npm run list:orgs
 */
import './lib/load-env.mjs';
import { createPgClient } from './lib/pg-client.mjs';
import { printTable } from './lib/table-format.mjs';

/**
 * @param {Array<Record<string, unknown>>} rows
 */
function printOrganizationTable(rows) {
  printTable(
    [
      { key: 'id', header: 'ID', width: 5 },
      { key: 'name', header: 'Name', width: 36 },
      { key: 'login_method', header: 'Login', width: 10 },
      { key: 'is_active', header: 'Active', width: 7 },
      { key: 'accounts', header: 'Accounts', width: 9 },
      { key: 'groups', header: 'Groups', width: 7 },
    ],
    rows,
    (row, column) => {
      if (column.key === 'is_active') {
        return row.is_active === true ? 'yes' : 'no';
      }
      return row[column.key];
    },
  );
}

async function listOrganizations(client) {
  const result = await client.query(
    `SELECT
       o.id,
       o.name,
       o.login_method,
       o.is_active,
       (SELECT COUNT(*)::int FROM auth.accounts a WHERE a.organization_id = o.id) AS accounts,
       (
         SELECT COUNT(*)::int
         FROM education.groups g
         JOIN auth.accounts ta ON ta.id = g.teacher_account_id
         WHERE ta.organization_id = o.id
       ) AS groups
     FROM auth.organizations o
     ORDER BY o.id ASC`,
  );
  return result.rows;
}

async function main() {
  const client = await createPgClient();
  try {
    const rows = await listOrganizations(client);
    if (rows.length === 0) {
      console.log('No organizations found.');
      return;
    }
    printOrganizationTable(rows);
    console.log(`\nTotal: ${rows.length}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
