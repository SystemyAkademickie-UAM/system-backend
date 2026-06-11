/** Role slug stored in `auth.accounts.role` for Game Master / lecturer flows. */
export const LECTURER_ROLE_NAME = 'lecturer';

/** Role slug stored in `auth.accounts.role` for learner enrollment (`gamification.enrollments`). */
export const STUDENT_ROLE_NAME = 'student';

/** Role slug stored in `auth.accounts.role` for administrator access. */
export const ADMINISTRATOR_ROLE_NAME = 'administrator';

/** Role slug stored in `auth.accounts.role` for super admin access. */
export const SUPER_ROLE_NAME = 'super';

/** Roles ordered from highest to lowest privilege (used for primary-role resolution and sorting). */
export const ROLE_PRIORITY_ORDER = [
  SUPER_ROLE_NAME,
  ADMINISTRATOR_ROLE_NAME,
  LECTURER_ROLE_NAME,
  STUDENT_ROLE_NAME,
] as const;
