#!/usr/bin/env node
/**
 * Provisions the local dev university: Localhost IdP + 7 IdP test accounts.
 *
 * Usage:
 *   node scripts/node-cli.mjs scripts/provision-dev-university.mjs
 *   node scripts/node-cli.mjs scripts/provision-dev-university.mjs -- --skip-docker
 *   provision-dev-university.bat   (Windows, from MyAcademyQuest1/)
 *
 * Creates:
 *   1. idp/data/users.json — 7 accounts in academy-idp (university identity only)
 *   2. SAML tenant "Localhost IdP" in PostgreSQL (register-org.mjs)
 *
 * Does NOT create auth.users / auth.accounts or complete in-app registration.
 * On first SAML login the backend provisions the app profile; each user completes
 * nickname, avatar and EULA in the /login wizard themselves.
 *
 * Docker: main docker-compose.yml service `idp` (container academy-idp).
 *
 * Test accounts (PIONIER.id -> Localhost IdP):
 *   student1/student1, student2/student2, student3/student3
 *   lecturer1/lecturer1, lecturer2/lecturer2, lecturer3/lecturer3
 *   administrator/administrator
 */
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './lib/load-env.mjs';
import { createPgClient } from './lib/pg-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.join(__dirname, '..');
const IDP_USERS_JSON = path.join(BACKEND_ROOT, 'idp', 'data', 'users.json');
const ENV_FILE = path.join(BACKEND_ROOT, '.env');

const ORGANIZATION_NAME = 'Localhost IdP';
const IDP_METADATA_URL = 'http://127.0.0.1:5000/simplesaml/saml2/idp/metadata.php';
const IDP_CONTAINER_NAME = 'academy-idp';
const LEGACY_IDP_COMPOSE_FILE = 'idp/docker-compose.yml';

/** @typedef {{ email: string, username: string, password: string, displayName: string, eduPersonAffiliation: string[] }} DevUserSpec */

/** @type {DevUserSpec[]} */
const DEV_UNIVERSITY_USERS = [
  {
    email: 'student1@localhost.invalid',
    username: 'student1',
    password: 'student1',
    displayName: 'Student One',
    eduPersonAffiliation: ['student', 'member'],
  },
  {
    email: 'student2@localhost.invalid',
    username: 'student2',
    password: 'student2',
    displayName: 'Student Two',
    eduPersonAffiliation: ['student', 'member'],
  },
  {
    email: 'student3@localhost.invalid',
    username: 'student3',
    password: 'student3',
    displayName: 'Student Three',
    eduPersonAffiliation: ['student', 'member'],
  },
  {
    email: 'lecturer1@localhost.invalid',
    username: 'lecturer1',
    password: 'lecturer1',
    displayName: 'Lecturer One',
    eduPersonAffiliation: ['faculty', 'member'],
  },
  {
    email: 'lecturer2@localhost.invalid',
    username: 'lecturer2',
    password: 'lecturer2',
    displayName: 'Lecturer Two',
    eduPersonAffiliation: ['faculty', 'member'],
  },
  {
    email: 'lecturer3@localhost.invalid',
    username: 'lecturer3',
    password: 'lecturer3',
    displayName: 'Lecturer Three',
    eduPersonAffiliation: ['faculty', 'member'],
  },
  {
    email: 'administrator@localhost.invalid',
    username: 'administrator',
    password: 'administrator',
    displayName: 'University Administrator',
    eduPersonAffiliation: ['staff', 'member'],
  },
];

function parseArgs(argv) {
  let skipDocker = false;
  for (const arg of argv) {
    if (arg === '--skip-docker') {
      skipDocker = true;
    }
    if (arg === '--help' || arg === '-h') {
      return { help: true, skipDocker: false };
    }
  }
  return { help: false, skipDocker };
}

function printUsage() {
  console.log(
    'Usage: node scripts/node-cli.mjs scripts/provision-dev-university.mjs [-- --skip-docker]\n\n' +
      '  --skip-docker   Skip db/idp Docker startup (only users.json + organization row)',
  );
}

function stopLegacyLocalIdp() {
  const result = spawnSync(
    'docker',
    ['compose', '-f', LEGACY_IDP_COMPOSE_FILE, 'down'],
    { cwd: BACKEND_ROOT, stdio: 'inherit', shell: false },
  );
  if (result.status === 0) {
    console.log('Stopped legacy maq-local-idp (idp/docker-compose.yml) to free port 5000.');
  }
}

function restartAcademyIdp() {
  const result = spawnSync(
    'docker',
    ['compose', 'restart', 'idp'],
    { cwd: BACKEND_ROOT, stdio: 'inherit', shell: false },
  );
  if (result.status !== 0) {
    throw new Error(`Failed to restart ${IDP_CONTAINER_NAME} (docker compose restart idp)`);
  }
}

function assertBackendLayout() {
  if (!existsSync(ENV_FILE)) {
    throw new Error(`Missing ${ENV_FILE} — copy .env.example and fill DATABASE_* and SAML_*`);
  }
  if (!existsSync(path.join(BACKEND_ROOT, 'package.json'))) {
    throw new Error(`Expected system-backend layout; script lives in ${__dirname}`);
  }
}

function runDockerCompose(composeArgs, composeFileRelativePath = null) {
  const args = ['compose'];
  if (composeFileRelativePath !== null) {
    args.push('-f', composeFileRelativePath);
  }
  args.push(...composeArgs);
  const result = spawnSync('docker', args, {
    cwd: BACKEND_ROOT,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });
  if (result.error) {
    throw new Error(`docker compose failed: ${result.error.message}. Is Docker Desktop running?`);
  }
  if (result.status !== 0) {
    throw new Error(`docker ${args.join(' ')} exited with code ${result.status ?? 1}`);
  }
}

function runBackendCliScript(scriptFileName, extraArgs = []) {
  const nodeCli = path.join(__dirname, 'node-cli.mjs');
  const scriptPath = path.join(__dirname, scriptFileName);
  const result = spawnSync(
    process.execPath,
    [nodeCli, scriptPath, ...extraArgs],
    { cwd: BACKEND_ROOT, stdio: 'inherit', shell: false, env: process.env },
  );
  if (result.status !== 0) {
    throw new Error(`${scriptFileName} exited with code ${result.status ?? 1}`);
  }
}

function writeIdpUsersFile() {
  const payload = {
    users: DEV_UNIVERSITY_USERS.map((user) => ({
      username: user.username,
      password: user.password,
      uid: user.username,
      eduPersonAffiliation: user.eduPersonAffiliation,
      eduPersonPrincipalName: user.email,
      mail: user.email,
      displayName: user.displayName,
    })),
  };
  writeFileSync(IDP_USERS_JSON, `${JSON.stringify(payload, null, 4)}\n`, 'utf8');
  console.log(`Wrote ${DEV_UNIVERSITY_USERS.length} IdP users -> ${IDP_USERS_JSON}`);
}

async function resolveOrganizationId(client, organizationName) {
  const byName = await client.query(
    `SELECT id, name FROM auth.organizations WHERE name = $1 ORDER BY id ASC LIMIT 1`,
    [organizationName],
  );
  if (byName.rowCount > 0) {
    return byName.rows[0].id;
  }
  const byMetadata = await client.query(
    `SELECT id, name FROM auth.organizations WHERE metadata_url = $1 ORDER BY id ASC LIMIT 1`,
    [IDP_METADATA_URL],
  );
  if (byMetadata.rowCount > 0) {
    console.log(
      `Organization found by metadata_url as "${byMetadata.rows[0].name}" (id=${byMetadata.rows[0].id})`,
    );
    return byMetadata.rows[0].id;
  }
  throw new Error(`Organization "${organizationName}" not found after register:org`);
}

function printSummary(organizationId) {
  console.log('\n=== Dev university ready ===');
  console.log(`Organization: "${ORGANIZATION_NAME}" (id=${organizationId})`);
  console.log(`IdP container: ${IDP_CONTAINER_NAME}`);
  console.log(`IdP metadata: ${IDP_METADATA_URL}`);
  console.log('\nIdP accounts (first login creates app profile; complete wizard yourself):\n');
  for (const user of DEV_UNIVERSITY_USERS) {
    console.log(`  ${user.username} / ${user.password}  (${user.email})`);
  }
  console.log('\nNext:');
  console.log('  npm run start:dev          (backend)');
  console.log('  cd ../system-frontend && npm run dev');
}

async function main() {
  const { help, skipDocker } = parseArgs(process.argv.slice(2));
  if (help) {
    printUsage();
    process.exit(0);
  }
  assertBackendLayout();
  writeIdpUsersFile();
  if (!skipDocker) {
    console.log('\n[1/3] PostgreSQL (academy-db)...');
    runDockerCompose(['up', '-d', 'db', '--wait']);
    stopLegacyLocalIdp();
    console.log(`\n[2/3] IdP ${IDP_CONTAINER_NAME} (docker-compose.yml service idp)...`);
    runDockerCompose(['up', '-d', 'idp', '--wait']);
    console.log(`Restarting ${IDP_CONTAINER_NAME} to reload idp/data/users.json...`);
    restartAcademyIdp();
  } else {
    console.log('\n[skip-docker] Assuming academy-db and academy-idp are already running.');
    console.log('If you changed users.json, restart manually: docker compose restart idp');
  }
  console.log('\n[3/3] SAML organization registration (register-org.mjs)...');
  runBackendCliScript('register-org.mjs', ['--name', ORGANIZATION_NAME, '--metadata-url', IDP_METADATA_URL]);
  const client = await createPgClient();
  let organizationId;
  try {
    organizationId = await resolveOrganizationId(client, ORGANIZATION_NAME);
  } finally {
    await client.end();
  }
  printSummary(organizationId);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
