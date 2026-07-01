import pg from 'pg';

export const AUTH_USER_EMAIL_MAX_LENGTH = 255;
export const AUTH_USER_NAME_FIELD_MAX_LENGTH = 100;

export function truncateField(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
}

export function assertDatabaseEnv() {
  const keys = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME'];
  const missing = keys.filter((key) => typeof process.env[key] !== 'string' || process.env[key].trim() === '');
  if (missing.length > 0) {
    throw new Error(`Missing DATABASE_* in .env: ${missing.join(', ')}`);
  }
}

export function resolveDatabaseHostForHostCli(rawHost) {
  const host = rawHost.trim().toLowerCase();
  if (host === 'host.docker.internal' || host === 'db') {
    return '127.0.0.1';
  }
  return rawHost.trim();
}

export function resolvePgSslOption() {
  const raw = (process.env.DATABASE_SSL ?? 'false').trim().toLowerCase();
  if (!['true', '1', 'yes'].includes(raw)) {
    return undefined;
  }
  const rejectRaw = (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? 'true').trim().toLowerCase();
  const rejectUnauthorized = !['false', '0', 'no'].includes(rejectRaw);
  return { rejectUnauthorized };
}

export function assertEmail(emailRaw) {
  const email = emailRaw.trim().toLowerCase();
  if (email.length === 0) {
    throw new Error('Email is required');
  }
  if (!email.includes('@') || email.startsWith('@') || email.endsWith('@')) {
    throw new Error(`Invalid email: ${emailRaw}`);
  }
  return truncateField(email, AUTH_USER_EMAIL_MAX_LENGTH);
}

export function resolveOrganizationId(orgIdRaw) {
  if (orgIdRaw.length === 0) {
    throw new Error('--org-id is required');
  }
  const parsed = Number.parseInt(orgIdRaw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Organization id must be a positive integer (--org-id)');
  }
  return parsed;
}

export function resolveUserId(userIdRaw) {
  if (userIdRaw.length === 0) {
    throw new Error('--id is required');
  }
  const parsed = Number.parseInt(userIdRaw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('User id must be a positive integer (--id)');
  }
  return parsed;
}

export async function createPgClient() {
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

export async function findUserIdByEmail(client, normalizedEmail) {
  const byExact = await client.query(`SELECT id, email FROM auth.users WHERE email = $1 LIMIT 1`, [
    normalizedEmail,
  ]);
  if (byExact.rowCount > 0) {
    return byExact.rows[0];
  }
  const byCaseInsensitive = await client.query(
    `SELECT id, email FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [normalizedEmail],
  );
  if (byCaseInsensitive.rowCount > 0) {
    return byCaseInsensitive.rows[0];
  }
  return null;
}
