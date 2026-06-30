#!/usr/bin/env node
/**
 * Shows one application user with profile fields and account memberships.
 *
 * Usage:
 *   npm run show:user -- --id 42
 */
import './lib/load-env.mjs';
import { createPgClient, resolveUserId } from './lib/pg-client.mjs';
import { printKeyValueTable } from './lib/table-format.mjs';
import {
  formatAccountMemberships,
  formatTimestamp,
  formatYesNo,
} from './lib/user-display.mjs';

function parseArgs(argv) {
  let userIdRaw = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--id' || arg === '--user-id') {
      userIdRaw = argv[index + 1]?.trim() ?? '';
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      return { help: true, userIdRaw: '' };
    }
  }
  return { help: false, userIdRaw };
}

function printUsage() {
  console.error('Usage: npm run show:user -- --id <userId>');
}

/**
 * @param {import('pg').Client} client
 * @param {number} userId
 */
async function loadUser(client, userId) {
  const userResult = await client.query(
    `SELECT
       u.id,
       u.email,
       u.student_id,
       u.name,
       u.surname,
       u.nickname,
       u.language,
       u.avatar_id,
       u.show_nickname,
       u.registration_completed,
       u.eula_accepted_at,
       u.profile_submitted_at,
       av.name AS avatar_name,
       av.image_url AS avatar_image_url
     FROM auth.users u
     LEFT JOIN auth.avatars av ON av.id = u.avatar_id
     WHERE u.id = $1
     LIMIT 1`,
    [userId],
  );
  if (userResult.rowCount === 0) {
    throw new Error(`User id ${userId} not found`);
  }

  const accountsResult = await client.query(
    `SELECT a.id AS account_id, a.organization_id, a.role, o.name AS organization_name
     FROM auth.accounts a
     JOIN auth.organizations o ON o.id = a.organization_id
     WHERE a.user_id = $1
     ORDER BY a.organization_id ASC, a.role ASC`,
    [userId],
  );

  return {
    user: userResult.rows[0],
    accounts: accountsResult.rows,
  };
}

/**
 * @param {Record<string, unknown>} user
 * @param {Array<Record<string, unknown>>} accounts
 */
function buildUserRows(user, accounts) {
  const icon =
    user.avatar_name && user.avatar_image_url
      ? `${user.avatar_id} (${user.avatar_name})`
      : String(user.avatar_id);

  return [
    { label: 'id', value: user.id },
    { label: 'email', value: user.email },
    { label: 'name', value: user.name },
    { label: 'surname', value: user.surname },
    { label: 'nickname', value: user.nickname },
    { label: 'language', value: user.language ?? '-' },
    { label: 'icon', value: icon },
    { label: 'avatar_url', value: user.avatar_image_url ?? '-' },
    { label: 'student_id', value: user.student_id },
    { label: 'show_nickname', value: formatYesNo(user.show_nickname) },
    { label: 'registration_completed', value: formatYesNo(user.registration_completed) },
    { label: 'profile_submitted_at', value: formatTimestamp(user.profile_submitted_at) },
    { label: 'eula_accepted_at', value: formatTimestamp(user.eula_accepted_at) },
    {
      label: 'accounts',
      value: formatAccountMemberships(
        accounts.map((row) => ({
          organization_id: row.organization_id,
          role: row.role,
        })),
      ),
    },
    {
      label: 'organizations',
      value:
        accounts.length === 0
          ? '-'
          : accounts
              .map((row) => `${row.organization_id} (${row.organization_name})`)
              .join('; '),
    },
  ];
}

async function main() {
  const { help, userIdRaw } = parseArgs(process.argv.slice(2));
  if (help) {
    printUsage();
    process.exit(0);
  }

  const userId = resolveUserId(userIdRaw);
  const client = await createPgClient();
  try {
    const { user, accounts } = await loadUser(client, userId);
    printKeyValueTable(buildUserRows(user, accounts));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
