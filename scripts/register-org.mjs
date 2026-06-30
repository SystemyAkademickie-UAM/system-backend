#!/usr/bin/env node
/**
 * Registers an organization tenant in auth.organizations.
 *
 * SAML (PIONIER / federation): fetches IdP metadata and stores certificate.
 * Email-only: creates a tenant for magic-link login (no SAML metadata).
 *
 * Dev/test SAML tenants use ids 2–10 (default). Production university tenants use
 * `--production` so the next id is at least 11.
 *
 * Usage (prefer npm — loads shared constants from src/):
 *   npm run register:org -- --name "Localhost IdP" --metadata-url "http://127.0.0.1:5000/.../metadata.php"
 *   npm run register:org -- --production --email-only --name "College Y"
 */
import './lib/load-env.mjs';
import { createHash, X509Certificate } from 'node:crypto';
import pg from 'pg';
import {
  FIRST_TENANT_ORGANIZATION_ID,
  ORGANIZATION_LOGIN_METHOD_EMAIL,
  ORGANIZATION_LOGIN_METHOD_SAML,
  ORGANIZATIONS_ID_SEQUENCE,
  PRIVATE_ORGANIZATION_ID,
} from '../src/constants/organization-constants.ts';

function parseArgs(argv) {
  let name = '';
  let metadataUrl = '';
  let productionTenant = false;
  let emailOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--name') {
      name = argv[index + 1]?.trim() ?? '';
      index += 1;
      continue;
    }
    if (arg === '--metadata-url') {
      metadataUrl = argv[index + 1]?.trim() ?? '';
      index += 1;
      continue;
    }
    if (arg === '--production') {
      productionTenant = true;
      continue;
    }
    if (arg === '--email-only') {
      emailOnly = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      return { help: true, name: '', metadataUrl: '', productionTenant: false, emailOnly: false };
    }
  }
  return { help: false, name, metadataUrl, productionTenant, emailOnly };
}

function printUsage() {
  console.error(
    'Usage:\n' +
      '  SAML:  node scripts/register-org.mjs [--production] --name "<name>" --metadata-url "<url>"\n' +
      '  Email: node scripts/register-org.mjs [--production] --email-only --name "<name>"',
  );
}

function firstMatch(xml, pattern) {
  const match = xml.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function extractSigningCertificatePem(xml) {
  const signingBlock = firstMatch(
    xml,
    /<(?:[\w:]+:)?KeyDescriptor[^>]*use="signing"[^>]*>([\s\S]*?)<\/(?:[\w:]+:)?KeyDescriptor>/i,
  );
  const searchIn = signingBlock ?? xml;
  const body = firstMatch(searchIn, /<(?:[\w:]+:)?X509Certificate>([^<]+)<\/(?:[\w:]+:)?X509Certificate>/i);
  if (body === null) {
    throw new Error('No signing X509Certificate found in IdP metadata');
  }
  const normalized = body.replace(/\s+/g, '');
  return `-----BEGIN CERTIFICATE-----\n${normalized.match(/.{1,64}/g)?.join('\n') ?? normalized}\n-----END CERTIFICATE-----\n`;
}

function parseIdpMetadataXml(xml) {
  const entityId =
    firstMatch(xml, /<(?:[\w:]+:)?EntityDescriptor[^>]*entityID="([^"]+)"/i) ??
    firstMatch(xml, /entityID="([^"]+)"/i);
  if (entityId === null) {
    throw new Error('No entityID found in IdP metadata');
  }
  const ssoLoginUrl =
    firstMatch(
      xml,
      /<(?:[\w:]+:)?SingleSignOnService[^>]*Binding="[^"]*HTTP-Redirect[^"]*"[^>]*Location="([^"]+)"/i,
    ) ??
    firstMatch(
      xml,
      /<(?:[\w:]+:)?SingleSignOnService[^>]*Location="([^"]+)"[^>]*Binding="[^"]*HTTP-Redirect/i,
    ) ??
    firstMatch(xml, /<(?:[\w:]+:)?SingleSignOnService[^>]*Location="([^"]+)"/i);
  if (ssoLoginUrl === null) {
    throw new Error('No SingleSignOnService Location found in IdP metadata');
  }
  const ssoLogoutUrl =
    firstMatch(
      xml,
      /<(?:[\w:]+:)?SingleLogoutService[^>]*Binding="[^"]*HTTP-Redirect[^"]*"[^>]*Location="([^"]+)"/i,
    ) ??
    firstMatch(
      xml,
      /<(?:[\w:]+:)?SingleLogoutService[^>]*Location="([^"]+)"[^>]*Binding="[^"]*HTTP-Redirect/i,
    ) ??
    firstMatch(xml, /<(?:[\w:]+:)?SingleLogoutService[^>]*Location="([^"]+)"/i);
  return {
    entityId,
    ssoLoginUrl,
    ssoLogoutUrl,
    signingCertificatePem: extractSigningCertificatePem(xml),
  };
}

async function fetchIdpMetadata(metadataUrl) {
  const response = await fetch(metadataUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch IdP metadata (${response.status}) from ${metadataUrl}`);
  }
  return parseIdpMetadataXml(await response.text());
}

function normalizePemCertificate(pem) {
  return pem
    .replace(/^\uFEFF/, '')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

function computeCertificateFingerprintSha256(pem) {
  const cert = new X509Certificate(normalizePemCertificate(pem));
  return createHash('sha256').update(cert.raw).digest('hex');
}

function parseCertificateValidity(pem) {
  const cert = new X509Certificate(normalizePemCertificate(pem));
  return {
    validFrom: cert.validFrom ? new Date(cert.validFrom) : null,
    validUntil: cert.validTo ? new Date(cert.validTo) : null,
  };
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

async function ensureProductionTenantSequence(client) {
  const reservedMaxId = FIRST_TENANT_ORGANIZATION_ID - 1;
  await client.query(`SELECT setval($1, GREATEST((SELECT COALESCE(MAX(id), 1) FROM auth.organizations), $2), true)`, [
    ORGANIZATIONS_ID_SEQUENCE,
    reservedMaxId,
  ]);
}

async function createPgClient() {
  assertDatabaseEnv();
  const parsedPort = Number.parseInt(process.env.DATABASE_PORT ?? '', 10);
  if (!Number.isFinite(parsedPort)) {
    throw new Error('DATABASE_PORT must be a valid integer');
  }
  const databaseHost = resolveDatabaseHostForHostCli(process.env.DATABASE_HOST ?? '');
  const ssl = resolvePgSslOption();
  const client = new pg.Client({
    host: databaseHost,
    port: parsedPort,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ...(ssl !== undefined ? { ssl } : {}),
  });
  try {
    await client.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `PostgreSQL connection failed (${databaseHost}:${parsedPort}): ${message}. ` +
        'Ensure `docker compose up -d db` is running and DATABASE_PORT matches the published host port.',
    );
  }
  return client;
}

async function registerEmailOnlyOrganization(client, organizationName, productionTenant) {
  await client.query('BEGIN');
  const existing = await client.query(
    `SELECT id FROM auth.organizations WHERE name = $1 ORDER BY id ASC LIMIT 1`,
    [organizationName],
  );

  let organizationId;
  if (existing.rowCount === 0) {
    if (productionTenant) {
      await ensureProductionTenantSequence(client);
      console.log(`Production tenant: next organization id will be >= ${FIRST_TENANT_ORGANIZATION_ID}`);
    }
    const inserted = await client.query(
      `INSERT INTO auth.organizations (name, login_method, is_active)
       VALUES ($1, $2, true)
       RETURNING id`,
      [organizationName, ORGANIZATION_LOGIN_METHOD_EMAIL],
    );
    organizationId = inserted.rows[0].id;
    console.log(`Created email organization id=${organizationId}`);
  } else {
    organizationId = existing.rows[0].id;
    if (organizationId === PRIVATE_ORGANIZATION_ID) {
      throw new Error(
        `Organization id ${PRIVATE_ORGANIZATION_ID} is the internal MAQ tenant and cannot be converted to an email tenant. ` +
          'Use `maq org repair-internal` if login_method was changed by mistake, then `maq user register … --org-id 1 --allow-internal-org`.',
      );
    }
    await client.query(
      `UPDATE auth.organizations
       SET name = $2, login_method = $3, is_active = true, updated_at = NOW()
       WHERE id = $1`,
      [organizationId, organizationName, ORGANIZATION_LOGIN_METHOD_EMAIL],
    );
    console.log(`Updated email organization id=${organizationId}`);
  }
  await client.query('COMMIT');
  console.log(
    `Registered email tenant "${organizationName}": organizationId=${organizationId} ` +
      `(provision users with npm run register:user -- --org-id ${organizationId})`,
  );
}

async function registerSamlOrganization(client, organizationName, metadataUrl, productionTenant) {
  console.log(`Fetching metadata from ${metadataUrl}…`);
  const metadata = await fetchIdpMetadata(metadataUrl);
  const pem = normalizePemCertificate(metadata.signingCertificatePem);
  const fingerprint = computeCertificateFingerprintSha256(pem);
  const validity = parseCertificateValidity(pem);

  await client.query('BEGIN');
  const existing = await client.query(
    `SELECT id, certificate_id FROM auth.organizations
     WHERE metadata_url = $1 OR name = $2
     ORDER BY id ASC
     LIMIT 1`,
    [metadataUrl, organizationName],
  );

  let organizationId;
  if (existing.rowCount === 0) {
    if (productionTenant) {
      await ensureProductionTenantSequence(client);
      console.log(`Production tenant: next organization id will be >= ${FIRST_TENANT_ORGANIZATION_ID}`);
    }
    const inserted = await client.query(
      `INSERT INTO auth.organizations (name, entity_id, metadata_url, sso_login_url, sso_logout_url, login_method, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id`,
      [
        organizationName,
        metadata.entityId,
        metadataUrl,
        metadata.ssoLoginUrl,
        metadata.ssoLogoutUrl,
        ORGANIZATION_LOGIN_METHOD_SAML,
      ],
    );
    organizationId = inserted.rows[0].id;
    console.log(`Created SAML organization id=${organizationId}`);
  } else {
    organizationId = existing.rows[0].id;
    if (organizationId === PRIVATE_ORGANIZATION_ID) {
      throw new Error(
        `Organization id ${PRIVATE_ORGANIZATION_ID} is the internal MAQ tenant and cannot be used for SAML. ` +
          'Restore org 1 (email/internal) and run register:org --production with a new metadata URL.',
      );
    }
    await client.query(
      `UPDATE auth.organizations
       SET name = $2, entity_id = $3, metadata_url = $4, sso_login_url = $5, sso_logout_url = $6,
           login_method = $7, is_active = true, updated_at = NOW()
       WHERE id = $1`,
      [
        organizationId,
        organizationName,
        metadata.entityId,
        metadataUrl,
        metadata.ssoLoginUrl,
        metadata.ssoLogoutUrl,
        ORGANIZATION_LOGIN_METHOD_SAML,
      ],
    );
    console.log(`Updated SAML organization id=${organizationId}`);
    const previousCertificateId = existing.rows[0].certificate_id;
    if (previousCertificateId !== null) {
      await client.query(`UPDATE auth.idp_certificates SET is_active = false WHERE id = $1`, [
        previousCertificateId,
      ]);
    }
  }

  const certInsert = await client.query(
    `INSERT INTO auth.idp_certificates (organization_id, certificate, fingerprint, valid_from, valid_until, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id`,
    [organizationId, pem, fingerprint, validity.validFrom, validity.validUntil],
  );
  const certificateId = certInsert.rows[0].id;
  await client.query(`UPDATE auth.organizations SET certificate_id = $2, updated_at = NOW() WHERE id = $1`, [
    organizationId,
    certificateId,
  ]);
  await client.query('COMMIT');
  console.log(
    `Registered SAML "${organizationName}": organizationId=${organizationId} certificateId=${certificateId} fingerprint=${fingerprint}`,
  );
}

async function registerOrganization(organizationName, metadataUrl, productionTenant, emailOnly) {
  const client = await createPgClient();
  try {
    if (emailOnly) {
      await registerEmailOnlyOrganization(client, organizationName, productionTenant);
      return;
    }
    await registerSamlOrganization(client, organizationName, metadataUrl, productionTenant);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const { help, name, metadataUrl, productionTenant, emailOnly } = parseArgs(process.argv.slice(2));
  if (help) {
    printUsage();
    process.exit(0);
  }
  if (name.length === 0) {
    printUsage();
    process.exit(1);
  }
  if (!emailOnly && metadataUrl.length === 0) {
    printUsage();
    process.exit(1);
  }
  if (emailOnly && metadataUrl.length > 0) {
    throw new Error('Use either --email-only or --metadata-url, not both');
  }
  await registerOrganization(name, metadataUrl, productionTenant, emailOnly);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
