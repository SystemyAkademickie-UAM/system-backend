import {
  ORGANIZATION_LOGIN_METHOD_EMAIL,
  ORGANIZATION_LOGIN_METHOD_INTERNAL,
  PRIVATE_ORGANIZATION_ID,
} from '../../src/constants/organization-constants.ts';
import { SUPER_ROLE_NAME } from '../../src/constants/role-name-constants.ts';

export async function assertOrganizationExists(client, organizationId) {
  const organization = await client.query(
    `SELECT id, name, login_method, is_active FROM auth.organizations WHERE id = $1 LIMIT 1`,
    [organizationId],
  );
  if (organization.rowCount === 0) {
    throw new Error(`Organization id ${organizationId} not found in auth.organizations`);
  }
  return organization.rows[0];
}

export async function assertOrganizationActive(client, organizationId) {
  const organization = await assertOrganizationExists(client, organizationId);
  if (organization.is_active === false) {
    throw new Error(`Organization id ${organizationId} is inactive`);
  }
  return organization;
}

export function assertInternalOrgAllowed(organizationId, allowInternalOrg) {
  if (organizationId === PRIVATE_ORGANIZATION_ID && !allowInternalOrg) {
    throw new Error(
      `Organization id ${PRIVATE_ORGANIZATION_ID} is MAQ internal/super only. ` +
        'Use --allow-internal-org for MAQ staff, or use a client tenant (--org-id >= 2).',
    );
  }
}

export function assertSuperRoleOrganization(organizationId, roleName) {
  if (roleName === SUPER_ROLE_NAME && organizationId !== PRIVATE_ORGANIZATION_ID) {
    throw new Error('Super role can only be used with organization id 1 (use --allow-internal-org).');
  }
}

export async function assertOrganizationAllowsEmailProvisioning(client, organizationId, allowInternalOrg, roleName) {
  assertInternalOrgAllowed(organizationId, allowInternalOrg);
  assertSuperRoleOrganization(organizationId, roleName);
  const organization = await assertOrganizationActive(client, organizationId);
  const loginMethod = organization.login_method;
  if (organizationId === PRIVATE_ORGANIZATION_ID) {
    if (loginMethod !== ORGANIZATION_LOGIN_METHOD_INTERNAL) {
      throw new Error(`Organization id ${PRIVATE_ORGANIZATION_ID} must have login_method=internal`);
    }
    return organization;
  }
  if (loginMethod !== ORGANIZATION_LOGIN_METHOD_EMAIL) {
    throw new Error(
      `Organization id ${organizationId} ("${organization.name}") uses login_method=${loginMethod}. ` +
        'Create an email tenant with register-org.mjs --email-only first.',
    );
  }
  return organization;
}
