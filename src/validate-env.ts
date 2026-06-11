import { API_TOKEN_HMAC_SECRET_MIN_LENGTH } from './constants/api-token-constants';
import { SAML_JWT_SECRET_MIN_LENGTH } from './constants/saml-constants';

const DATABASE_ENV_KEYS = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
] as const;

const SAML_CERT_PATH_ENV_KEYS = [
  'SAML_SP_CERT_PATH',
  'SAML_SP_PRIVATE_KEY_PATH',
] as const;

const REQUIRED_STRING_ENV_KEYS = [
  'NODE_ENV',
  ...DATABASE_ENV_KEYS,
  'SAML_SP_ENTITY_ID',
  'SAML_ACS_URL',
  'SAML_LOGIN_SUCCESS_URL',
  'SAML_JWT_SECRET',
  ...SAML_CERT_PATH_ENV_KEYS,
] as const;

export { DATABASE_ENV_KEYS, REQUIRED_STRING_ENV_KEYS, SAML_CERT_PATH_ENV_KEYS };

const ENV_SETUP_HINT = 'Copy .env.example to .env and fill all required values.';

/** True when the value is a non-empty string after trim. */
export function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function collectMissingStringKeys(keys: readonly string[]): string[] {
  const missing: string[] = [];
  for (const key of keys) {
    if (!isNonEmptyString(process.env[key])) {
      missing.push(key);
    }
  }
  return missing;
}

function collectProductionApiTokenIssues(): string[] {
  if (process.env.NODE_ENV !== 'production') {
    return [];
  }
  const secret = process.env.API_TOKEN_HMAC_SECRET;
  if (!isNonEmptyString(secret)) {
    return ['API_TOKEN_HMAC_SECRET'];
  }
  if (secret.trim().length < API_TOKEN_HMAC_SECRET_MIN_LENGTH) {
    return [`API_TOKEN_HMAC_SECRET (min ${API_TOKEN_HMAC_SECRET_MIN_LENGTH} characters in production)`];
  }
  return [];
}

function collectProductionSamlJwtSecretIssues(): string[] {
  if (process.env.NODE_ENV !== 'production') {
    return [];
  }
  const secret = process.env.SAML_JWT_SECRET;
  if (!isNonEmptyString(secret)) {
    return ['SAML_JWT_SECRET'];
  }
  if (secret.trim().length < SAML_JWT_SECRET_MIN_LENGTH) {
    return [`SAML_JWT_SECRET (min ${SAML_JWT_SECRET_MIN_LENGTH} characters in production)`];
  }
  return [];
}

function throwIfMissing(missing: string[]): void {
  if (missing.length === 0) {
    return;
  }
  const bulletList = missing.map((item) => `- ${item}`).join('\n');
  throw new Error(`Missing required environment variables:\n${bulletList}\n${ENV_SETUP_HINT}`);
}

/** Ensures PostgreSQL connection env vars are set (used by TypeORM CLI / migrations). */
export function assertDatabaseEnv(): void {
  throwIfMissing(collectMissingStringKeys(DATABASE_ENV_KEYS));
}

/** Ensures required API startup env vars are set (presence only, not correctness). */
export function assertRequiredEnv(): void {
  const missing = [
    ...collectMissingStringKeys(REQUIRED_STRING_ENV_KEYS),
    ...collectProductionApiTokenIssues(),
    ...collectProductionSamlJwtSecretIssues(),
  ];
  throwIfMissing(missing);
}
