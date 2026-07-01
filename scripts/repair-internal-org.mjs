#!/usr/bin/env node
/**
 * Restores org id 1 login_method to `internal` after accidental email-tenant registration.
 *
 * Usage:
 *   npm run repair:internal-org
 */
import './lib/load-env.mjs';
import { createPgClient } from './lib/pg-client.mjs';
import { repairInternalOrganizationLoginMethod } from './lib/org-provisioning.mjs';

async function main() {
  const client = await createPgClient();
  try {
    const repaired = await repairInternalOrganizationLoginMethod(client);
    if (!repaired) {
      console.log('Organization id 1 already uses login_method=internal.');
      return;
    }
    console.log(
      `Repaired organization id=${repaired.id} name="${repaired.name}" login_method=${repaired.login_method}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
