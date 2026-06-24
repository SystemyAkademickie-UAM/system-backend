/**
 * Account removal SQL for CLI scripts — mirrors AccountRemovalService transaction shape.
 */

import { SUPER_ROLE_NAME } from '../../src/constants/role-name-constants.ts';

export async function withPgTransaction(client, work) {
  await client.query('BEGIN');
  try {
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function assertAccountCanBePurged(client, accountId) {
  const ownedGroups = await client.query(
    `SELECT COUNT(*)::int AS count FROM education.groups WHERE teacher_account_id = $1`,
    [accountId],
  );
  const ownedGroupCount = ownedGroups.rows[0]?.count ?? 0;
  if (ownedGroupCount > 0) {
    throw new Error(
      `Account ${accountId} owns ${ownedGroupCount} group(s); reassign or remove them first`,
    );
  }
}

/** Deletes enrollments, backlog rows, and templates tied to the account — not the account row itself. */
export async function purgeAccountDependentData(client, accountId) {
  await assertAccountCanBePurged(client, accountId);
  const enrollments = await client.query(
    `SELECT id, group_id FROM gamification.enrollments WHERE student_account_id = $1`,
    [accountId],
  );
  for (const enrollment of enrollments.rows) {
    await client.query(`DELETE FROM gamification.earned_badges WHERE enrollment_id = $1`, [enrollment.id]);
    await client.query(`DELETE FROM gamification.student_stats WHERE enrollment_id = $1`, [enrollment.id]);
    await client.query(
      `DELETE FROM analytics.activity_backlog WHERE group_id = $1 AND account_id = $2`,
      [enrollment.group_id, accountId],
    );
    await client.query(`DELETE FROM gamification.enrollments WHERE id = $1`, [enrollment.id]);
  }
  await client.query(`DELETE FROM analytics.backlog WHERE account_id = $1`, [accountId]);
  await client.query(`DELETE FROM education.group_templates WHERE creator_account_id = $1`, [accountId]);
}

export async function removeUserIfOrphaned(client, userId, email) {
  const remaining = await client.query(`SELECT COUNT(*)::int AS count FROM auth.accounts WHERE user_id = $1`, [
    userId,
  ]);
  if ((remaining.rows[0]?.count ?? 0) > 0) {
    return false;
  }
  await client.query(`DELETE FROM auth.sessions WHERE user_id = $1`, [userId]);
  await client.query(`DELETE FROM auth.magic_link_tokens WHERE LOWER(email) = LOWER($1)`, [email]);
  await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
  return true;
}

/**
 * Purges dependent rows, deletes the account, and removes the user when no memberships remain.
 * Must run inside an open transaction (`withPgTransaction` or explicit BEGIN).
 *
 * @param {import('pg').Client} client
 */
export async function removeOrganizationAccount(client, accountId, userId, email) {
  await purgeAccountDependentData(client, accountId);
  await client.query(`DELETE FROM auth.accounts WHERE id = $1`, [accountId]);
  const userRemoved = await removeUserIfOrphaned(client, userId, email);
  return { accountId, userId, userRemoved };
}

/**
 * @param {import('pg').Client} client
 * @param {string} normalizedEmail
 * @param {number | null} organizationId When set, only memberships in that organization are removed.
 */
export async function unregisterUser(client, normalizedEmail, organizationId = null) {
  const user = await client.query(
    `SELECT id, email FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [normalizedEmail],
  );
  if (user.rowCount === 0) {
    throw new Error(`No user found for email ${normalizedEmail}`);
  }
  const userId = user.rows[0].id;
  const email = user.rows[0].email;
  let accountQuery = `SELECT id FROM auth.accounts WHERE user_id = $1`;
  const params = [userId];
  if (organizationId !== null) {
    accountQuery += ` AND organization_id = $2`;
    params.push(organizationId);
  }
  const accounts = await client.query(accountQuery, params);
  if (accounts.rowCount === 0) {
    throw new Error(
      organizationId === null
        ? `User ${normalizedEmail} has no accounts to remove`
        : `User ${normalizedEmail} has no accounts in organization ${organizationId}`,
    );
  }
  const removedAccountIds = [];
  let userRemoved = false;
  for (const row of accounts.rows) {
    const result = await removeOrganizationAccount(client, row.id, userId, email);
    removedAccountIds.push(result.accountId);
    userRemoved = result.userRemoved;
  }
  return { userId, removedAccountIds, userRemoved };
}

/**
 * @param {import('pg').Client} client
 */
export async function revokeUserRole(client, normalizedEmail, organizationId, roleName) {
  if (roleName === SUPER_ROLE_NAME) {
    throw new Error('Super administrator accounts cannot be revoked via CLI');
  }
  const user = await client.query(
    `SELECT id, email FROM auth.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [normalizedEmail],
  );
  if (user.rowCount === 0) {
    throw new Error(`No user found for email ${normalizedEmail}`);
  }
  const userId = user.rows[0].id;
  const email = user.rows[0].email;
  const account = await client.query(
    `SELECT id FROM auth.accounts
     WHERE user_id = $1 AND organization_id = $2 AND role = $3
     LIMIT 1`,
    [userId, organizationId, roleName],
  );
  if (account.rowCount === 0) {
    throw new Error(
      `User ${normalizedEmail} has no ${roleName} account in organization ${organizationId}`,
    );
  }
  return removeOrganizationAccount(client, account.rows[0].id, userId, email);
}
