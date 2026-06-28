#!/usr/bin/env node
/**
 * Revokes one auth.accounts role for a user in an organization (with dependent-data cleanup).
 * Removes auth.users when no account memberships remain.
 *
 * Usage:
 *   npm run revoke:user-role -- user@example.com --org-id 12 --student
 *   npm run revoke:user-role -- admin@example.com --org-id 5 --administrator
 */
import './lib/load-env.mjs';
import { assertEmail, createPgClient, resolveOrganizationId } from './lib/pg-client.mjs';
import {
  assertInternalOrgAllowed,
  assertOrganizationActive,
} from './lib/org-provisioning.mjs';
import { parseRoleFromArgs, roleFlagUsageSuffix } from './lib/role-args.mjs';
import { revokeUserRole, withPgTransaction } from './lib/account-removal.mjs';

function parseArgs(argv) {
  let email = '';
  let orgIdRaw = '';
  let allowInternalOrg = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--org-id') {
      orgIdRaw = argv[index + 1]?.trim() ?? '';
      index += 1;
      continue;
    }
    if (arg === '--allow-internal-org') {
      allowInternalOrg = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      return { help: true, email: '', orgIdRaw: '', allowInternalOrg: false, roleName: '' };
    }
    if (!arg.startsWith('-') && email.length === 0) {
      email = arg.trim();
    }
  }
  let roleName;
  try {
    roleName = parseRoleFromArgs(argv, { roleRequired: true });
  } catch {
    printUsage();
    process.exit(1);
  }
  return { help: false, email, orgIdRaw, allowInternalOrg, roleName };
}

function printUsage() {
  console.error(
    `Usage: npm run revoke:user-role -- <email> --org-id <id> ${roleFlagUsageSuffix()} [--allow-internal-org]`,
  );
}

async function main() {
  const { help, email, orgIdRaw, allowInternalOrg, roleName } = parseArgs(process.argv.slice(2));
  if (help) {
    printUsage();
    process.exit(0);
  }
  if (email.length === 0) {
    printUsage();
    process.exit(1);
  }
  const normalizedEmail = assertEmail(email);
  const organizationId = resolveOrganizationId(orgIdRaw);
  const client = await createPgClient();
  try {
    const result = await withPgTransaction(client, async (tx) => {
      assertInternalOrgAllowed(organizationId, allowInternalOrg);
      await assertOrganizationActive(tx, organizationId);
      return revokeUserRole(tx, normalizedEmail, organizationId, roleName, { allowInternalOrg });
    });
    console.log(
      `Revoked ${roleName} from ${normalizedEmail}: accountId=${result.accountId} userId=${result.userId} ` +
        `organizationId=${organizationId} userRemoved=${result.userRemoved}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
