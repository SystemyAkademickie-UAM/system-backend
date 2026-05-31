#!/usr/bin/env node
/**
 * Registers an IdP organization in auth.organizations + auth.idp_certificates
 * by fetching federation metadata. Reads DATABASE_* from system-backend/.env .
 *
 * Usage:
 *   node scripts/register-org.mjs --name "Org name" --metadata-url "https://.../metadata.php"
 */
import 'dotenv/config';
import { createHash, X509Certificate } from 'node:crypto';
import pg from 'pg';

function parseArgs(argv) {
  let name = '';
  let metadataUrl = '';
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
    if (arg === '--help' || arg === '-h') {
      return { help: true, name: '', metadataUrl: '' };
    }
  }
  return { help: false, name, metadataUrl };
}

function printUsage() {
  console.error('Usage: node scripts/register-org.mjs --name "<organization name>" --metadata-url "<metadata url>"');
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

/** CLI scripts run on the host; map Docker-only hostnames to localhost. */
function resolveDatabaseHostForHostCli(rawHost) {
  const host = rawHost.trim().toLowerCase();
  if (host === 'host.docker.internal' || host === 'db') {
    return '127.0.0.1';
  }
  return rawHost.trim();
}

async function registerOrganization(organizationName, metadataUrl) {
  assertDatabaseEnv();
  const parsedPort = Number.parseInt(process.env.DATABASE_PORT ?? '', 10);
  if (!Number.isFinite(parsedPort)) {
    throw new Error('DATABASE_PORT must be a valid integer');
  }
  const databaseHost = resolveDatabaseHostForHostCli(process.env.DATABASE_HOST ?? '');

  console.log(`Fetching metadata from ${metadataUrl}…`);
  const metadata = await fetchIdpMetadata(metadataUrl);
  const pem = normalizePemCertificate(metadata.signingCertificatePem);
  const fingerprint = computeCertificateFingerprintSha256(pem);
  const validity = parseCertificateValidity(pem);

  console.log(`Connecting to PostgreSQL at ${databaseHost}:${parsedPort}…`);
  const client = new pg.Client({
    host: databaseHost,
    port: parsedPort,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
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

  try {
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
      const inserted = await client.query(
        `INSERT INTO auth.organizations (name, entity_id, metadata_url, sso_login_url, sso_logout_url, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id`,
        [organizationName, metadata.entityId, metadataUrl, metadata.ssoLoginUrl, metadata.ssoLogoutUrl],
      );
      organizationId = inserted.rows[0].id;
      console.log(`Created organization id=${organizationId}`);
    } else {
      organizationId = existing.rows[0].id;
      await client.query(
        `UPDATE auth.organizations
         SET name = $2, entity_id = $3, metadata_url = $4, sso_login_url = $5, sso_logout_url = $6, is_active = true, updated_at = NOW()
         WHERE id = $1`,
        [
          organizationId,
          organizationName,
          metadata.entityId,
          metadataUrl,
          metadata.ssoLoginUrl,
          metadata.ssoLogoutUrl,
        ],
      );
      console.log(`Updated organization id=${organizationId}`);
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
      `Registered "${organizationName}": organizationId=${organizationId} certificateId=${certificateId} fingerprint=${fingerprint}`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const { help, name, metadataUrl } = parseArgs(process.argv.slice(2));
  if (help) {
    printUsage();
    process.exit(0);
  }
  if (name.length === 0 || metadataUrl.length === 0) {
    printUsage();
    process.exit(1);
  }
  await registerOrganization(name, metadataUrl);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
