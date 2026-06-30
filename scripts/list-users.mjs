#!/usr/bin/env node
/**
 * Lists application users with roles and organization memberships.
 *
 * Usage:
 *   npm run list:users
 */
import './lib/load-env.mjs';
import { createPgClient } from './lib/pg-client.mjs';
import { printTable } from './lib/table-format.mjs';
import {
  formatCountPrefixedList,
  formatYesNo,
  sortOrganizationIds,
  sortRoles,
} from './lib/user-display.mjs';

/**
 * @param {import('pg').Client} client
 */
async function listUsers(client) {
  const result = await client.query(
    `SELECT
       u.id,
       u.email,
       u.registration_completed,
       COUNT(a.id)::int AS account_count,
       COALESCE(
         array_agg(DISTINCT a.role ORDER BY a.role) FILTER (WHERE a.role IS NOT NULL),
         ARRAY[]::varchar[]
       ) AS roles,
       COALESCE(
         array_agg(DISTINCT a.organization_id ORDER BY a.organization_id) FILTER (WHERE a.organization_id IS NOT NULL),
         ARRAY[]::int[]
       ) AS organization_ids
     FROM auth.users u
     LEFT JOIN auth.accounts a ON a.user_id = u.id
     GROUP BY u.id, u.email, u.registration_completed
     ORDER BY u.id ASC`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    roles: formatCountPrefixedList(sortRoles(row.roles ?? [])),
    organization_ids: formatCountPrefixedList(sortOrganizationIds(row.organization_ids ?? [])),
    accounts: row.account_count,
    registered: formatYesNo(row.registration_completed),
  }));
}

async function main() {
  const client = await createPgClient();
  try {
    const rows = await listUsers(client);
    if (rows.length === 0) {
      console.log('No users found.');
      return;
    }

    printTable(
      [
        { key: 'id', header: 'ID', width: 6 },
        { key: 'email', header: 'Email', width: 34 },
        { key: 'roles', header: 'Roles', width: 40 },
        { key: 'organization_ids', header: 'Org IDs', width: 18 },
        { key: 'accounts', header: 'Accounts', width: 9 },
        { key: 'registered', header: 'Registered', width: 11 },
      ],
      rows,
    );
    console.log(`\nTotal: ${rows.length}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
