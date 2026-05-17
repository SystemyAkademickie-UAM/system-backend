/**
 * PostgreSQL SSL options for `pg` / TypeORM.
 * Remote hosts (e.g. university-managed) often require TLS; without `ssl`, connections fail with pg_hba / SSL off errors.
 */
export type PostgresSslOption = false | { rejectUnauthorized: boolean };

const TRUTHY = new Set(['true', '1', 'yes']);

export function resolvePostgresSslOption(read: (key: string) => string | undefined): PostgresSslOption {
  const raw = (read('DATABASE_SSL') ?? 'false').trim().toLowerCase();
  if (!TRUTHY.has(raw)) {
    return false;
  }
  const rejectRaw = (read('DATABASE_SSL_REJECT_UNAUTHORIZED') ?? 'true').trim().toLowerCase();
  const rejectUnauthorized =
    rejectRaw !== 'false' && rejectRaw !== '0' && rejectRaw !== 'no';
  return { rejectUnauthorized };
}
