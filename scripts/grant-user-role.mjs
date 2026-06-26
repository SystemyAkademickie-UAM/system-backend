#!/usr/bin/env node
/**
 * Grants an auth.accounts role to an existing user in an organization.
 * Does not create auth.users — use register:user for first-time provisioning.
 *
 * Usage:
 *   npm run grant:user-role -- user@example.com --org-id 12 --lecturer
 *   npm run grant:user-role -- admin@example.com --org-id 5 --administrator
 */
import './lib/load-env.mjs';
import {
  assertEmail,
  createPgClient,
  findUserIdByEmail,
  resolveOrganizationId,
} from './lib/pg-client.mjs';
import {
  assertInternalOrgAllowed,
  assertOrganizationActive,
  assertSuperRoleOrganization,
} from './lib/org-provisioning.mjs';
import { parseRoleFromArgs, roleFlagUsageSuffix } from './lib/role-args.mjs';
import { withPgTransaction } from './lib/account-removal.mjs';

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
    `Usage: npm run grant:user-role -- <email> --org-id <id> ${roleFlagUsageSuffix()} [--allow-internal-org]`,
  );
}

async function grantUserRole(emailRaw, organizationId, roleName, allowInternalOrg) {
  const normalizedEmail = assertEmail(emailRaw);
  const client = await createPgClient();
  try {
    await withPgTransaction(client, async (tx) => {
      assertInternalOrgAllowed(organizationId, allowInternalOrg);
      assertSuperRoleOrganization(organizationId, roleName);
      const organization = await assertOrganizationActive(tx, organizationId);
      const existingUser = await findUserIdByEmail(tx, normalizedEmail);
      if (existingUser === null) {
        throw new Error(
          `No user with email ${normalizedEmail}. Provision first: npm run register:user -- ${normalizedEmail} --org-id ${organizationId}`,
        );
      }
      const existingAccount = await tx.query(
        `SELECT id FROM auth.accounts
         WHERE user_id = $1 AND organization_id = $2 AND role = $3
         LIMIT 1`,
        [existingUser.id, organizationId, roleName],
      );
      if (existingAccount.rowCount > 0) {
        console.log(
          `Role unchanged: ${normalizedEmail} already has ${roleName} in org ${organizationId} ` +
            `(accountId=${existingAccount.rows[0].id}, org="${organization.name}")`,
        );
        return;
      }
      const inserted = await tx.query(
        `INSERT INTO auth.accounts (user_id, organization_id, role)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [existingUser.id, organizationId, roleName],
      );
      console.log(
        `Granted ${roleName} to ${normalizedEmail}: userId=${existingUser.id} accountId=${inserted.rows[0].id} ` +
          `organizationId=${organizationId} (org="${organization.name}")`,
      );
    });
  } finally {
    await client.end();
  }
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
  const organizationId = resolveOrganizationId(orgIdRaw);
  await grantUserRole(email, organizationId, roleName, allowInternalOrg);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
