#!/usr/bin/env node
/**
 * Removes all auth.accounts rows for a user and deletes auth.users when no memberships remain.
 *
 * Usage:
 *   npm run unregister:user -- user@example.com
 *   npm run unregister:user -- user@example.com --org-id 12
 */
import './lib/load-env.mjs';
import { assertEmail, createPgClient, resolveOrganizationId } from './lib/pg-client.mjs';
import { unregisterUser, withPgTransaction } from './lib/account-removal.mjs';

function parseArgs(argv) {
  let email = '';
  let orgIdRaw = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--org-id') {
      orgIdRaw = argv[index + 1]?.trim() ?? '';
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      return { help: true, email: '', orgIdRaw: '' };
    }
    if (!arg.startsWith('-') && email.length === 0) {
      email = arg.trim();
    }
  }
  return { help: false, email, orgIdRaw };
}

function printUsage() {
  console.error('Usage: npm run unregister:user -- <email> [--org-id <id>]');
}

async function main() {
  const { help, email, orgIdRaw } = parseArgs(process.argv.slice(2));
  if (help) {
    printUsage();
    process.exit(0);
  }
  if (email.length === 0) {
    printUsage();
    process.exit(1);
  }
  const normalizedEmail = assertEmail(email);
  const organizationId = orgIdRaw.length > 0 ? resolveOrganizationId(orgIdRaw) : null;
  const client = await createPgClient();
  try {
    const result = await withPgTransaction(client, (tx) =>
      unregisterUser(tx, normalizedEmail, organizationId),
    );
    console.log(
      `Unregistered ${normalizedEmail}: userId=${result.userId} removedAccountIds=[${result.removedAccountIds.join(', ')}] ` +
        `userRemoved=${result.userRemoved}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
