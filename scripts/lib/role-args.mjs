import {
  ADMINISTRATOR_ROLE_NAME,
  LECTURER_ROLE_NAME,
  STUDENT_ROLE_NAME,
  SUPER_ROLE_NAME,
} from '../../src/constants/role-name-constants.ts';

export const ROLE_FLAGS = [
  ['--student', STUDENT_ROLE_NAME],
  ['--lecturer', LECTURER_ROLE_NAME],
  ['--administrator', ADMINISTRATOR_ROLE_NAME],
  ['--super', SUPER_ROLE_NAME],
];

/**
 * @param {string[]} argv
 * @param {{ defaultRole?: string, roleRequired?: boolean }} [options]
 */
export function parseRoleFromArgs(argv, options = {}) {
  const defaultRole = options.defaultRole ?? STUDENT_ROLE_NAME;
  const roleRequired = options.roleRequired === true;
  const selectedRoles = [];
  for (const arg of argv) {
    const roleFlag = ROLE_FLAGS.find(([flagName]) => flagName === arg);
    if (roleFlag !== undefined) {
      selectedRoles.push(roleFlag[1]);
    }
  }
  if (selectedRoles.length > 1) {
    throw new Error('Specify at most one role flag: --student, --lecturer, --administrator, --super');
  }
  if (roleRequired && selectedRoles.length === 0) {
    throw new Error('A role flag is required: --student, --lecturer, --administrator, or --super');
  }
  return selectedRoles[0] ?? defaultRole;
}

export function roleFlagUsageSuffix() {
  return '[--student|--lecturer|--administrator|--super]';
}
