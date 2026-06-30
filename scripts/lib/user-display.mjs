/** Role slugs ordered from highest to lowest privilege — mirrors role-name-constants.ts. */
export const ROLE_PRIORITY_ORDER = ['super', 'administrator', 'lecturer', 'student'];

/**
 * @param {string[]} roles
 */
export function sortRoles(roles) {
  return [...roles].sort(
    (left, right) => ROLE_PRIORITY_ORDER.indexOf(left) - ROLE_PRIORITY_ORDER.indexOf(right),
  );
}

/**
 * @param {number[]} organizationIds
 */
export function sortOrganizationIds(organizationIds) {
  return [...organizationIds].sort((left, right) => left - right);
}

/**
 * Formats a list as `value` (one item) or `count: a,b,c` (multiple items).
 *
 * @param {Array<string | number>} items
 */
export function formatCountPrefixedList(items) {
  if (items.length === 0) {
    return '-';
  }
  const text = items.join(',');
  if (items.length === 1) {
    return text;
  }
  return `${items.length}: ${text}`;
}

/**
 * @param {Array<{ organization_id: number, role: string }>} accounts
 */
export function formatAccountMemberships(accounts) {
  if (accounts.length === 0) {
    return '-';
  }
  const sorted = [...accounts].sort((left, right) => {
    if (left.organization_id !== right.organization_id) {
      return left.organization_id - right.organization_id;
    }
    return ROLE_PRIORITY_ORDER.indexOf(left.role) - ROLE_PRIORITY_ORDER.indexOf(right.role);
  });
  return sorted.map((row) => `${row.organization_id}:${row.role}`).join('; ');
}

/**
 * @param {unknown} value
 */
export function formatTimestamp(value) {
  if (value === null || value === undefined) {
    return '-';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

/**
 * @param {boolean | null | undefined} value
 */
export function formatYesNo(value) {
  return value === true ? 'yes' : 'no';
}
