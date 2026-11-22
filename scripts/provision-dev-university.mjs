#!/usr/bin/env node
/**
 * Provisions the local dev university: Localhost IdP + 19 IdP test accounts (15 students, 3 lecturers, 1 admin).
 *
 * Usage:
 *   node scripts/node-cli.mjs scripts/provision-dev-university.mjs
 *   node scripts/node-cli.mjs scripts/provision-dev-university.mjs -- --skip-docker
 *   provision-dev-university.bat   (Windows, from MyAcademyQuest1/)
 *
 * Creates:
 *   1. idp/data/users.json — 19 accounts in academy-idp (university identity only)
 *   2. SAML tenant "Localhost IdP" in PostgreSQL (register-org.mjs)
 *
 * Does NOT create auth.users / auth.accounts or complete in-app registration.
 * On first SAML login the backend provisions the app profile; each user completes
 * nickname, avatar and EULA in the /login wizard themselves.
 *
 * Docker: main docker-compose.yml service `idp` (container academy-idp).
 *
 * Test accounts (PIONIER.id -> Localhost IdP):
 *   student1/student1 ... student15/student15
 *   lecturer1/lecturer1, lecturer2/lecturer2, lecturer3/lecturer3
 *   administrator/administrator
 */
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './lib/load-env.mjs';
import { createPgClient } from './lib/pg-client.mjs';
import {
  ADMINISTRATOR_ROLE_NAME,
  LECTURER_ROLE_NAME,
  SUPER_ROLE_NAME,
} from '../src/constants/role-name-constants.ts';
import { PRIVATE_ORGANIZATION_ID } from '../src/constants/organization-constants.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.join(__dirname, '..');
const IDP_USERS_JSON = path.join(BACKEND_ROOT, 'idp', 'data', 'users.json');
const ENV_FILE = path.join(BACKEND_ROOT, '.env');

const ORGANIZATION_NAME = 'Localhost IdP';
const IDP_METADATA_URL = 'http://127.0.0.1:5000/simplesaml/saml2/idp/metadata.php';
const IDP_CONTAINER_NAME = 'academy-idp';
const LEGACY_IDP_COMPOSE_FILE = 'idp/docker-compose.yml';

/** @typedef {{ email: string, username: string, password: string, givenName: string, surname: string, displayName: string, eduPersonAffiliation: string[] }} DevUserSpec */

/**
 * @param {string} username
 * @param {string} givenName
 * @param {string} surname
 * @param {string} displayName
 * @param {string[]} eduPersonAffiliation
 * @returns {DevUserSpec}
 */
function devUser(username, givenName, surname, displayName, eduPersonAffiliation) {
  return {
    email: `${username}@localhost.invalid`,
    username,
    password: username,
    givenName,
    surname,
    displayName,
    eduPersonAffiliation,
  };
}

/** @type {DevUserSpec[]} */
const DEV_UNIVERSITY_USERS = [
  ...Array.from({ length: 15 }, (_, i) => {
    const num = i + 1;
    return devUser(
      `student${num}`,
      'Student',
      String(num),
      `Student ${num}`,
      ['student', 'member'],
    );
  }),
  devUser('lecturer1', 'Lecturer', 'One', 'Lecturer One', ['faculty', 'member']),
  devUser('lecturer2', 'Lecturer', 'Two', 'Lecturer Two', ['faculty', 'member']),
  devUser('lecturer3', 'Lecturer', 'Three', 'Lecturer Three', ['faculty', 'member']),
  devUser('administrator', 'University', 'Administrator', 'University Administrator', ['staff', 'member']),
  devUser('multirole', 'Multirole', 'User', 'Multirole User', ['faculty', 'staff', 'member']),
  devUser('multirole1', 'Multirole', 'One', 'Multirole One', ['faculty', 'staff', 'member']),
  devUser('multirole2', 'Multirole', 'Two', 'Multirole Two', ['faculty', 'staff', 'member']),
  devUser('name-single', 'Jan', 'Kowalski', 'Kowalski Jan', ['student', 'member']),
  devUser('name-two-two', 'Jan Krzysztof', 'Pawłak Kowalski', 'Pawłak Kowalski Jan Krzysztof', ['student', 'member']),
  devUser('name-hyphen', 'Jan Krzysztof', 'Pawłak-Kowalski', 'Pawłak-Kowalski Jan Krzysztof', ['student', 'member']),
  devUser('name-reversed', 'Paweł', 'Nawrocki', 'Nawrocki Paweł', ['student', 'member']),
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

function runDatabaseMigrations() {
  const typeormCli = path.join(BACKEND_ROOT, 'node_modules', 'typeorm', 'cli.js');
  const dataSource = path.join(BACKEND_ROOT, 'src', 'database', 'data-source.ts');
  const result = spawnSync(
    process.execPath,
    [
      '--require',
      'ts-node/register',
      '--require',
      'tsconfig-paths/register',
      typeormCli,
      'migration:run',
      '-d',
      dataSource,
    ],
    {
      cwd: BACKEND_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      shell: false,
      env: process.env,
    },
  );
  if (result.status !== 0) {
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    throw new Error(`Migracje bazy danych zakonczyly sie kodem ${result.status ?? 1}`);
  }
  const stdout = result.stdout || '';
  if (stdout.includes('No migrations are pending')) {
    console.log('Baza danych jest aktualna (brak nowych migracji).');
  } else {
    const match = stdout.match(/(\d+)\s+migrations are new migrations must be executed/);
    const count = match ? match[1] : 'wszystkie';
    console.log(`Zastosowano migracje bazy danych (${count}). Schemat zaktualizowany.`);
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
      givenName: user.givenName,
      sn: user.surname,
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

const MULTIROLE_SPECS = [
  { username: 'multirole', givenName: 'Multirole', surname: 'User' },
  { username: 'multirole1', givenName: 'Multirole', surname: 'One' },
  { username: 'multirole2', givenName: 'Multirole', surname: 'Two' },
];

async function ensureMultiroleAccounts(client, organizationId) {
  const roles = [SUPER_ROLE_NAME, ADMINISTRATOR_ROLE_NAME, LECTURER_ROLE_NAME];
  const internalOrg = await client.query(
    `SELECT id FROM auth.organizations WHERE id = $1 LIMIT 1`,
    [PRIVATE_ORGANIZATION_ID],
  );

  for (const spec of MULTIROLE_SPECS) {
    const email = `${spec.username}@localhost.invalid`;

    let userResult = await client.query(
      `SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email],
    );
    let userId;
    if (userResult.rowCount === 0) {
      const insertUser = await client.query(
        `INSERT INTO auth.users (
           email, student_id, name, surname, nickname, language, avatar_id,
           registration_completed, eula_accepted_at, profile_submitted_at
         )
         VALUES ($1, 0, $2, $3, $4, 'PL', 1, false, NULL, NULL)
         RETURNING id`,
        [email, spec.givenName, spec.surname, spec.username],
      );
      userId = insertUser.rows[0].id;
      console.log(`Created multirole user "${spec.username}" in auth.users (id=${userId}, registration wizard enabled)`);
    } else {
      userId = userResult.rows[0].id;
      // Reset registration flags so that login enters the registration wizard (same as student1)
      await client.query(
        `UPDATE auth.users
         SET registration_completed = false,
             eula_accepted_at = NULL,
             profile_submitted_at = NULL
         WHERE id = $1`,
        [userId],
      );
      console.log(`Reset registration flags for "${spec.username}" (id=${userId}, registration wizard enabled)`);
    }

    for (const role of roles) {
      const existing = await client.query(
        `SELECT id FROM auth.accounts WHERE user_id = $1 AND organization_id = $2 AND role = $3 LIMIT 1`,
        [userId, organizationId, role],
      );
      if (existing.rowCount === 0) {
        await client.query(
          `INSERT INTO auth.accounts (user_id, organization_id, role) VALUES ($1, $2, $3)`,
          [userId, organizationId, role],
        );
        console.log(`Granted role "${role}" in organization id=${organizationId} to "${spec.username}" (id=${userId})`);
      }
    }

    if (internalOrg.rowCount > 0) {
      const existingInternalSuper = await client.query(
        `SELECT id FROM auth.accounts WHERE user_id = $1 AND organization_id = $2 AND role = $3 LIMIT 1`,
        [userId, PRIVATE_ORGANIZATION_ID, SUPER_ROLE_NAME],
      );
      if (existingInternalSuper.rowCount === 0) {
        await client.query(
          `INSERT INTO auth.accounts (user_id, organization_id, role) VALUES ($1, $2, $3)`,
          [userId, PRIVATE_ORGANIZATION_ID, SUPER_ROLE_NAME],
        );
        console.log(`Granted role "${SUPER_ROLE_NAME}" in organization id=${PRIVATE_ORGANIZATION_ID} to "${spec.username}" (id=${userId})`);
      }
    }
  }
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
  console.log('\nKonta wielorolowe z 3 rolami (super, administrator, lecturer):');
  for (const spec of MULTIROLE_SPECS) {
    console.log(`  ${spec.username} / ${spec.username}  (${spec.username}@localhost.invalid)`);
  }
  console.log('  Uwaga: Konta rozpoczynaja od pelnego kreatora rejestracji (pseudonim, awatar, regulamin).');
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
    console.log('\n[1/4] PostgreSQL (academy-db)...');
    runDockerCompose(['up', '-d', 'db', '--wait']);
    stopLegacyLocalIdp();
    console.log(`\n[2/4] IdP ${IDP_CONTAINER_NAME} (docker-compose.yml service idp)...`);
    runDockerCompose(['up', '-d', 'idp', '--wait']);
    console.log(`Restarting ${IDP_CONTAINER_NAME} to reload idp/data/users.json...`);
    restartAcademyIdp();
  } else {
    console.log('\n[skip-docker] Assuming academy-db and academy-idp are already running.');
    console.log('If you changed users.json, restart manually: docker compose restart idp');
  }
  console.log('\n[3/4] Database migrations (migrate:local)...');
  runDatabaseMigrations();
  console.log('\n[4/4] SAML organization registration (register-org.mjs)...');
  runBackendCliScript('register-org.mjs', ['--name', ORGANIZATION_NAME, '--metadata-url', IDP_METADATA_URL]);
  const client = await createPgClient();
  let organizationId;
  try {
    organizationId = await resolveOrganizationId(client, ORGANIZATION_NAME);
    await ensureMultiroleAccounts(client, organizationId);
  } finally {
    await client.end();
  }
  printSummary(organizationId);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
