/**
 * Full organization teardown for CLI scripts — groups, accounts, users, org row.
 */

import { PRIVATE_ORGANIZATION_ID } from '../../src/constants/organization-constants.ts';
import { removeOrganizationAccount, withPgTransaction } from './account-removal.mjs';

/**
 * @param {import('pg').Client} client
 * @param {number[]} groupIds
 */
export async function deleteGroupsByIds(client, groupIds) {
  if (groupIds.length === 0) {
    return 0;
  }

  await client.query(
    `DELETE FROM gamification.transactions t
     USING gamification.enrollments e
     WHERE t.enrollment_id = e.id AND e.group_id = ANY($1::int[])`,
    [groupIds],
  );
  await client.query(
    `DELETE FROM gamification.earned_items ei
     USING gamification.enrollments e
     WHERE ei.enrollment_id = e.id AND e.group_id = ANY($1::int[])`,
    [groupIds],
  );
  await client.query(
    `DELETE FROM gamification.earned_badges eb
     USING gamification.enrollments e
     WHERE eb.enrollment_id = e.id AND e.group_id = ANY($1::int[])`,
    [groupIds],
  );
  await client.query(
    `DELETE FROM gamification.student_stats ss
     USING gamification.enrollments e
     WHERE ss.enrollment_id = e.id AND e.group_id = ANY($1::int[])`,
    [groupIds],
  );
  await client.query(`DELETE FROM gamification.enrollments WHERE group_id = ANY($1::int[])`, [groupIds]);

  await client.query(`DELETE FROM analytics.activity_backlog WHERE group_id = ANY($1::int[])`, [groupIds]);
  await client.query(`DELETE FROM analytics.backlog WHERE group_id = ANY($1::int[])`, [groupIds]);

  await client.query(
    `DELETE FROM gamification.shop_listings sl
     USING gamification.items i
     WHERE sl.item_id = i.id AND i.group_id = ANY($1::int[])`,
    [groupIds],
  );
  await client.query(`DELETE FROM gamification.items WHERE group_id = ANY($1::int[])`, [groupIds]);
  await client.query(`DELETE FROM gamification.item_categories WHERE group_id = ANY($1::int[])`, [groupIds]);

  await client.query(
    `DELETE FROM gamification.shop_items WHERE group_id = ANY($1::int[])`,
    [groupIds],
  ).catch(() => undefined);

  await client.query(`DELETE FROM gamification.badges WHERE group_id = ANY($1::int[])`, [groupIds]);
  await client.query(`DELETE FROM gamification.ranks WHERE group_id = ANY($1::int[])`, [groupIds]);

  await client.query(
    `DELETE FROM education.activities a
     USING education.stages s
     WHERE a.stage_id = s.id AND s.group_id = ANY($1::int[])`,
    [groupIds],
  );
  await client.query(`DELETE FROM education.stages WHERE group_id = ANY($1::int[])`, [groupIds]);
  await client.query(`DELETE FROM education.posts WHERE group_id = ANY($1::int[])`, [groupIds]);
  await client.query(`DELETE FROM education.enrollment_codes WHERE group_id = ANY($1::int[])`, [groupIds]);

  const deleted = await client.query(
    `DELETE FROM education.groups WHERE id = ANY($1::int[]) RETURNING id`,
    [groupIds],
  );
  return deleted.rowCount ?? 0;
}

/**
 * @param {import('pg').Client} client
 * @param {number} organizationId
 */
async function findOrganizationGroupIds(client, organizationId) {
  const result = await client.query(
    `SELECT g.id
     FROM education.groups g
     JOIN auth.accounts a ON a.id = g.teacher_account_id
     WHERE a.organization_id = $1
     ORDER BY g.id ASC`,
    [organizationId],
  );
  return result.rows.map((row) => row.id);
}

/**
 * @param {import('pg').Client} client
 * @param {number} organizationId
 */
export async function purgeOrganization(client, organizationId) {
  if (organizationId === PRIVATE_ORGANIZATION_ID) {
    throw new Error(
      `Organization id ${PRIVATE_ORGANIZATION_ID} is the internal MAQ tenant and cannot be unregistered`,
    );
  }

  const organization = await client.query(
    `SELECT id, name, login_method, is_active
     FROM auth.organizations
     WHERE id = $1
     LIMIT 1`,
    [organizationId],
  );
  if (organization.rowCount === 0) {
    throw new Error(`Organization id ${organizationId} not found`);
  }

  const orgRow = organization.rows[0];
  const groupIds = await findOrganizationGroupIds(client, organizationId);
  const deletedGroupCount = await deleteGroupsByIds(client, groupIds);

  const accounts = await client.query(
    `SELECT a.id AS account_id, a.user_id, u.email
     FROM auth.accounts a
     JOIN auth.users u ON u.id = a.user_id
     WHERE a.organization_id = $1
     ORDER BY a.id ASC`,
    [organizationId],
  );

  const removedAccountIds = [];
  let usersRemoved = 0;
  for (const row of accounts.rows) {
    const result = await removeOrganizationAccount(client, row.account_id, row.user_id, row.email);
    removedAccountIds.push(result.accountId);
    if (result.userRemoved) {
      usersRemoved += 1;
    }
  }

  const sessions = await client.query(`DELETE FROM auth.sessions WHERE organization_id = $1`, [organizationId]);
  const magicLinks = await client.query(
    `DELETE FROM auth.magic_link_tokens WHERE organization_id = $1`,
    [organizationId],
  );
  const drives = await client.query(`DELETE FROM services.drive WHERE organization_id = $1`, [organizationId]);
  await client.query(`DELETE FROM auth.idp_certificates WHERE organization_id = $1`, [organizationId]);

  await client.query(`DELETE FROM auth.organizations WHERE id = $1`, [organizationId]);

  return {
    organizationId,
    organizationName: orgRow.name,
    loginMethod: orgRow.login_method,
    deletedGroupCount,
    removedAccountIds,
    usersRemoved,
    deletedSessionCount: sessions.rowCount ?? 0,
    deletedMagicLinkCount: magicLinks.rowCount ?? 0,
    deletedDriveCount: drives.rowCount ?? 0,
  };
}

/**
 * @param {import('pg').Client} client
 * @param {number} organizationId
 */
export async function unregisterOrganizationById(client, organizationId) {
  return withPgTransaction(client, (tx) => purgeOrganization(tx, organizationId));
}
