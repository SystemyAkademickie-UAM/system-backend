import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { config as loadDotenv } from 'dotenv';

const DOT_ENV_FILE_NAME = '.env';

const REQUIRED_KEYS = [
  'SAML_SP_ENTITY_ID',
  'SAML_ACS_URL',
  'SAML_IDP_ENTRY_POINT',
  'SAML_JWT_SECRET',
  'SAML_LOGIN_SUCCESS_URL',
] as const;

function trimmed(name: string): string {
  return (process.env[name] ?? '').trim();
}

function exitWith(message: string): never {
  console.error(`[ENV] ${message}`);
  process.exit(1);
}

function assertPemAvailable(inlineVar: string, pathVar: string): void {
  if (trimmed(inlineVar).length > 0) {
    return;
  }
  const filePath = trimmed(pathVar);
  if (filePath.length === 0) {
    exitWith(`Missing ${inlineVar} or ${pathVar}: set inline PEM body or path to file.`);
  }
  if (!existsSync(filePath)) {
    exitWith(`${pathVar} must point to an existing file (got "${filePath}").`);
  }
}

const cwd = process.cwd();
const envFilePath = join(cwd, DOT_ENV_FILE_NAME);

if (!existsSync(envFilePath)) {
  exitWith(
    `Missing ${DOT_ENV_FILE_NAME} under ${cwd}. Copy .env.example to .env and configure.`,
  );
}

const dotenvOutcome = loadDotenv({ path: envFilePath });
if (dotenvOutcome.error) {
  exitWith(`Cannot parse ${DOT_ENV_FILE_NAME}: ${dotenvOutcome.error.message}`);
}

for (const key of REQUIRED_KEYS) {
  if (trimmed(key).length === 0) {
    exitWith(`Missing or empty ${key} in ${DOT_ENV_FILE_NAME}.`);
  }
}

assertPemAvailable('SAML_IDP_CERT', 'SAML_IDP_CERT_PATH');
assertPemAvailable('SAML_SP_CERT', 'SAML_SP_CERT_PATH');
assertPemAvailable('SAML_SP_PRIVATE_KEY', 'SAML_SP_PRIVATE_KEY_PATH');
