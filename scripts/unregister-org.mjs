#!/usr/bin/env node
/**
 * Removes an organization tenant and all dependent data (groups, accounts, users, drives, …).
 *
 * Usage:
 *   npm run unregister:org -- --org-id 13
 */
import './lib/load-env.mjs';
import { createPgClient, resolveOrganizationId } from './lib/pg-client.mjs';
import { unregisterOrganizationById } from './lib/organization-removal.mjs';

function parseArgs(argv) {
  let orgIdRaw = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--org-id' || arg === '--id') {
      orgIdRaw = argv[index + 1]?.trim() ?? '';
      index += 1;
      continue;
    }
    if (arg === '--name') {
      throw new Error('--name is not supported; use --org-id (organization names are not unique)');
    }
    if (arg === '--help' || arg === '-h') {
      return { help: true, orgIdRaw: '' };
    }
  }
  return { help: false, orgIdRaw };
}

function printUsage() {
  console.error('Usage: npm run unregister:org -- --org-id <organizationId>');
}

async function main() {
  const { help, orgIdRaw } = parseArgs(process.argv.slice(2));
  if (help) {
    printUsage();
    process.exit(0);
  }
  const organizationId = resolveOrganizationId(orgIdRaw);
  const client = await createPgClient();
  try {
    const result = await unregisterOrganizationById(client, organizationId);
    console.log(
      `Unregistered organization id=${result.organizationId} name="${result.organizationName}" ` +
        `login=${result.loginMethod}: ` +
        `groups=${result.deletedGroupCount} accounts=${result.removedAccountIds.length} ` +
        `usersRemoved=${result.usersRemoved} sessions=${result.deletedSessionCount} ` +
        `magicLinks=${result.deletedMagicLinkCount} drives=${result.deletedDriveCount}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
