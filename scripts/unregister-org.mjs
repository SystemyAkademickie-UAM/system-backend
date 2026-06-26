#!/usr/bin/env node
/**
 * Deactivates a SAML organization (e.g. demo IdP after project defence).
 * Clears SSO fields so the org disappears from the institution picker.
 *
 * Usage:
 *   node scripts/unregister-org.mjs --id 2
 *   node scripts/unregister-org.mjs --name "Localhost IdP"
 */
import './lib/load-env.mjs';
import pg from 'pg';
import { PRIVATE_ORGANIZATION_ID } from '../src/constants/organization-constants.ts';

function parseArgs(argv) {
  let organizationIdRaw = '';
  let organizationName = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--id') {
      organizationIdRaw = argv[index + 1]?.trim() ?? '';
      index += 1;
      continue;
    }
    if (arg === '--name') {
      organizationName = argv[index + 1]?.trim() ?? '';
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      return { help: true, organizationIdRaw: '', organizationName: '' };
    }
  }
  return { help: false, organizationIdRaw, organizationName };
}

function printUsage() {
  console.error('Usage: node scripts/unregister-org.mjs --id <organizationId>');
  console.error('   or: node scripts/unregister-org.mjs --name "<organization name>"');
}

function assertDatabaseEnv() {
  const keys = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME'];
  const missing = keys.filter((key) => typeof process.env[key] !== 'string' || process.env[key].trim() === '');
  if (missing.length > 0) {
    throw new Error(`Missing DATABASE_* in .env: ${missing.join(', ')}`);
  }
}

function resolveDatabaseHostForHostCli(rawHost) {
  const host = rawHost.trim().toLowerCase();
  if (host === 'host.docker.internal' || host === 'db') {
    return '127.0.0.1';
  }
  return rawHost.trim();
}

function resolvePgSslOption() {
  const raw = (process.env.DATABASE_SSL ?? 'false').trim().toLowerCase();
  if (!['true', '1', 'yes'].includes(raw)) {
    return undefined;
  }
  const rejectRaw = (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? 'true').trim().toLowerCase();
  const rejectUnauthorized = !['false', '0', 'no'].includes(rejectRaw);
  return { rejectUnauthorized };
}

async function createPgClient() {
  assertDatabaseEnv();
  const parsedPort = Number.parseInt(process.env.DATABASE_PORT ?? '', 10);
  if (!Number.isFinite(parsedPort)) {
    throw new Error('DATABASE_PORT must be a valid integer');
  }
  const client = new pg.Client({
    host: resolveDatabaseHostForHostCli(process.env.DATABASE_HOST ?? ''),
    port: parsedPort,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ...(resolvePgSslOption() !== undefined ? { ssl: resolvePgSslOption() } : {}),
  });
  await client.connect();
  return client;
}

async function unregisterOrganization(organizationIdRaw, organizationName) {
  const client = await createPgClient();
  try {
    await client.query('BEGIN');
    let organizationId = null;
    if (organizationIdRaw.length > 0) {
      const parsed = Number.parseInt(organizationIdRaw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('--id must be a positive integer');
      }
      organizationId = parsed;
    } else if (organizationName.length > 0) {
      const row = await client.query(`SELECT id FROM auth.organizations WHERE name = $1 LIMIT 1`, [organizationName]);
      if (row.rowCount === 0) {
        throw new Error(`Organization not found: ${organizationName}`);
      }
      organizationId = row.rows[0].id;
    } else {
      throw new Error('Provide --id or --name');
    }

    const existing = await client.query(`SELECT id, name FROM auth.organizations WHERE id = $1 LIMIT 1`, [organizationId]);
    if (existing.rowCount === 0) {
      throw new Error(`Organization id ${organizationId} not found`);
    }
    if (organizationId === PRIVATE_ORGANIZATION_ID) {
      throw new Error(`Organization id ${PRIVATE_ORGANIZATION_ID} is the private magic-link tenant and cannot be unregistered`);
    }

    await client.query(
      `UPDATE auth.organizations
       SET is_active = false,
           entity_id = NULL,
           metadata_url = NULL,
           sso_login_url = NULL,
           sso_logout_url = NULL,
           certificate_id = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [organizationId],
    );
    await client.query(`UPDATE auth.idp_certificates SET is_active = false WHERE organization_id = $1`, [organizationId]);
    await client.query('COMMIT');
    console.log(`Unregistered SAML organization id=${organizationId} name="${existing.rows[0].name}"`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const { help, organizationIdRaw, organizationName } = parseArgs(process.argv.slice(2));
  if (help) {
    printUsage();
    process.exit(0);
  }
  await unregisterOrganization(organizationIdRaw, organizationName);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
