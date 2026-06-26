#!/usr/bin/env node
/**
 * Provisions auth.users (when missing) and an auth.accounts row for an organization.
 *
 * Usage:
 *   npm run register:user -- user@example.com --org-id 12
 *   npm run register:user -- jan@example.com --org-id 12 --name Jan --surname Kowalski
 *   npm run register:user -- super@maq.local --org-id 1 --super --allow-internal-org
 *   npm run register:user -- gm@example.com --org-id 12 --lecturer --complete-registration
 */
import './lib/load-env.mjs';
import { assertEmail, createPgClient, findUserIdByEmail, resolveOrganizationId } from './lib/pg-client.mjs';
import { assertOrganizationAllowsEmailProvisioning } from './lib/org-provisioning.mjs';
import {
  parseProfileFromArgs,
  profileFlagUsageSuffix,
  resolveProfileForNewUser,
} from './lib/profile-args.mjs';
import { parseRoleFromArgs, roleFlagUsageSuffix } from './lib/role-args.mjs';
import { withPgTransaction } from './lib/account-removal.mjs';

function parseArgs(argv) {
  let email = '';
  let orgIdRaw = '';
  let completeRegistration = false;
  let allowInternalOrg = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--org-id') {
      orgIdRaw = argv[index + 1]?.trim() ?? '';
      index += 1;
      continue;
    }
    if (arg === '--complete-registration') {
      completeRegistration = true;
      continue;
    }
    if (arg === '--allow-internal-org') {
      allowInternalOrg = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      return {
        help: true,
        email: '',
        orgIdRaw: '',
        completeRegistration: false,
        allowInternalOrg: false,
        roleName: '',
      };
    }
    if (!arg.startsWith('-') && email.length === 0) {
      email = arg.trim();
    }
  }
  const roleName = parseRoleFromArgs(argv);
  return { help: false, email, orgIdRaw, completeRegistration, allowInternalOrg, roleName };
}

function printUsage() {
  console.error(
    `Usage: npm run register:user -- <email> --org-id <id> ${roleFlagUsageSuffix()} ${profileFlagUsageSuffix()} ` +
      '[--complete-registration] [--allow-internal-org]',
  );
}

function buildExistingUserProfileUpdate(provided) {
  const setClauses = [];
  /** @type {unknown[]} */
  const values = [];
  let paramIndex = 1;
  if (provided.name !== null) {
    setClauses.push(`name = $${paramIndex}`);
    values.push(provided.name);
    paramIndex += 1;
  }
  if (provided.surname !== null) {
    setClauses.push(`surname = $${paramIndex}`);
    values.push(provided.surname);
    paramIndex += 1;
  }
  if (provided.nickname !== null) {
    setClauses.push(`nickname = $${paramIndex}`);
    values.push(provided.nickname);
    paramIndex += 1;
  }
  if (provided.avatarId !== null) {
    setClauses.push(`avatar_id = $${paramIndex}`);
    values.push(provided.avatarId);
    paramIndex += 1;
  }
  if (provided.language !== null) {
    setClauses.push(`language = $${paramIndex}`);
    values.push(provided.language);
    paramIndex += 1;
  }
  if (provided.studentId !== null) {
    setClauses.push(`student_id = $${paramIndex}`);
    values.push(provided.studentId);
    paramIndex += 1;
  }
  return { setClauses, values, nextParamIndex: paramIndex };
}

async function assertAvatarExists(tx, avatarId) {
  const avatar = await tx.query(`SELECT id FROM auth.avatars WHERE id = $1 LIMIT 1`, [avatarId]);
  if (avatar.rowCount === 0) {
    throw new Error(`Avatar ${avatarId} does not exist`);
  }
}

async function registerUser(
  emailRaw,
  organizationId,
  roleName,
  completeRegistration,
  allowInternalOrg,
  providedProfile,
) {
  const normalizedEmail = assertEmail(emailRaw);
  const profile = resolveProfileForNewUser(normalizedEmail, providedProfile);
  const client = await createPgClient();
  try {
    await withPgTransaction(client, async (tx) => {
      const organization = await assertOrganizationAllowsEmailProvisioning(
        tx,
        organizationId,
        allowInternalOrg,
        roleName,
      );
      const existingUser = await findUserIdByEmail(tx, normalizedEmail);
      let userId = existingUser?.id ?? null;
      let userCreated = false;
      const avatarIdToUse = providedProfile.avatarId ?? profile.avatarId;
      await assertAvatarExists(tx, avatarIdToUse);
      if (userId === null) {
        const inserted = await tx.query(
          `INSERT INTO auth.users (
             email, student_id, name, surname, nickname, language, avatar_id,
             registration_completed, eula_accepted_at, profile_submitted_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            normalizedEmail,
            profile.studentId,
            profile.name,
            profile.surname,
            profile.nickname,
            profile.language,
            profile.avatarId,
            completeRegistration,
            completeRegistration ? new Date() : null,
            completeRegistration ? new Date() : null,
          ],
        );
        userId = inserted.rows[0].id;
        userCreated = true;
      } else {
        const profileUpdate = buildExistingUserProfileUpdate(providedProfile);
        if (completeRegistration) {
          profileUpdate.setClauses.push('registration_completed = true');
          profileUpdate.setClauses.push('eula_accepted_at = COALESCE(eula_accepted_at, NOW())');
          profileUpdate.setClauses.push('profile_submitted_at = COALESCE(profile_submitted_at, NOW())');
        }
        if (profileUpdate.setClauses.length > 0) {
          await tx.query(
            `UPDATE auth.users SET ${profileUpdate.setClauses.join(', ')} WHERE id = $${profileUpdate.nextParamIndex}`,
            [...profileUpdate.values, userId],
          );
        }
      }
      const existingAccount = await tx.query(
        `SELECT id FROM auth.accounts
         WHERE user_id = $1 AND organization_id = $2 AND role = $3
         LIMIT 1`,
        [userId, organizationId, roleName],
      );
      let accountCreated = false;
      if (existingAccount.rowCount === 0) {
        await tx.query(
          `INSERT INTO auth.accounts (user_id, organization_id, role)
           VALUES ($1, $2, $3)`,
          [userId, organizationId, roleName],
        );
        accountCreated = true;
      }
      console.log(
        `Registered ${normalizedEmail}: userId=${userId} organizationId=${organizationId} role=${roleName} ` +
          `(org="${organization.name}") userCreated=${userCreated} accountCreated=${accountCreated} ` +
          `registrationCompleted=${completeRegistration ? true : userCreated ? false : 'unchanged'}`,
      );
    });
  } finally {
    await client.end();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const { help, email, orgIdRaw, completeRegistration, allowInternalOrg, roleName } = parseArgs(argv);
  if (help) {
    printUsage();
    process.exit(0);
  }
  if (email.length === 0) {
    printUsage();
    process.exit(1);
  }
  const providedProfile = parseProfileFromArgs(argv);
  const organizationId = resolveOrganizationId(orgIdRaw);
  await registerUser(
    email,
    organizationId,
    roleName,
    completeRegistration,
    allowInternalOrg,
    providedProfile,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
