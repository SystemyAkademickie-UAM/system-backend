import type { SamlUser } from '../auth/saml/saml.types';
import {
  ADMINISTRATOR_ROLE_NAME,
  LECTURER_ROLE_NAME,
  STUDENT_ROLE_NAME,
  SUPER_ROLE_NAME,
} from './role-name-constants';

/** `auth.organizations.name` when bypass seeds an organization because none exist. */
export const SAML_BYPASS_SEED_ORGANIZATION_NAME = 'Dev organization (bypass seed)';

/** Dev bypass persona id (POST `/auth/saml/bypass/session` body). */
export type SamlBypassPersonaId =
  | 'student1'
  | 'student2'
  | 'lecturer1'
  | 'lecturer2'
  | 'admin'
  | 'superadmin';

export const SAML_BYPASS_PERSONA_IDS: readonly SamlBypassPersonaId[] = [
  'student1',
  'student2',
  'lecturer1',
  'lecturer2',
  'admin',
  'superadmin',
];

/**
 * Session role returned by `/auth/saml/me` — must match frontend `SessionContext` mapping
 * (`student` | `lecturer` | `admin` | `superadmin`).
 */
export type SamlBypassSessionRole = 'student' | 'lecturer' | 'admin' | 'superadmin';

export interface SamlBypassPersonaDefinition {
  readonly id: SamlBypassPersonaId;
  readonly label: string;
  readonly sessionRole: SamlBypassSessionRole;
  /** Row in `auth.accounts.role` when applicable. */
  readonly accountRole: string;
  readonly user: SamlUser;
}

export const SAML_BYPASS_PERSONAS: Record<SamlBypassPersonaId, SamlBypassPersonaDefinition> = {
  student1: {
    id: 'student1',
    label: 'Student 1',
    sessionRole: 'student',
    accountRole: STUDENT_ROLE_NAME,
    user: {
      nameId: 'dev-bypass-student-1',
      email: 'dev.student1@localhost.invalid',
      displayName: 'Dev Student 1',
      affiliations: ['student', 'member'],
      role: 'student',
    },
  },
  student2: {
    id: 'student2',
    label: 'Student 2',
    sessionRole: 'student',
    accountRole: STUDENT_ROLE_NAME,
    user: {
      nameId: 'dev-bypass-student-2',
      email: 'dev.student2@localhost.invalid',
      displayName: 'Dev Student 2',
      affiliations: ['student', 'member'],
      role: 'student',
    },
  },
  lecturer1: {
    id: 'lecturer1',
    label: 'Lecturer 1',
    sessionRole: 'lecturer',
    accountRole: LECTURER_ROLE_NAME,
    user: {
      nameId: 'dev-bypass-lecturer-1',
      email: 'dev.lecturer1@localhost.invalid',
      displayName: 'Dev Lecturer 1',
      affiliations: ['faculty', 'employee'],
      role: 'lecturer',
    },
  },
  lecturer2: {
    id: 'lecturer2',
    label: 'Lecturer 2',
    sessionRole: 'lecturer',
    accountRole: LECTURER_ROLE_NAME,
    user: {
      nameId: 'dev-bypass-lecturer-2',
      email: 'dev.lecturer2@localhost.invalid',
      displayName: 'Dev Lecturer 2',
      affiliations: ['faculty', 'employee'],
      role: 'lecturer',
    },
  },
  admin: {
    id: 'admin',
    label: 'Administrator',
    sessionRole: 'admin',
    accountRole: ADMINISTRATOR_ROLE_NAME,
    user: {
      nameId: 'dev-bypass-admin',
      email: 'dev.admin@localhost.invalid',
      displayName: 'Dev Administrator',
      affiliations: ['staff', 'employee'],
      role: 'admin',
    },
  },
  superadmin: {
    id: 'superadmin',
    label: 'Superadministrator',
    sessionRole: 'superadmin',
    accountRole: SUPER_ROLE_NAME,
    user: {
      nameId: 'dev-bypass-superadmin',
      email: 'dev.superadmin@localhost.invalid',
      displayName: 'Dev Superadministrator',
      affiliations: ['staff', 'employee'],
      role: 'superadmin',
    },
  },
};

/** @deprecated Use `student1` persona id. */
export const SAML_BYPASS_DEV_STUDENT_SUB = SAML_BYPASS_PERSONAS.student1.user.nameId;

/** @deprecated Use `lecturer1` persona id. */
export const SAML_BYPASS_DEV_LECTURER_SUB = SAML_BYPASS_PERSONAS.lecturer1.user.nameId;

/** @deprecated Use `SAML_BYPASS_PERSONAS.student1.user`. */
export const SAML_BYPASS_DEV_STUDENT_USER = SAML_BYPASS_PERSONAS.student1.user;

/** @deprecated Use `SAML_BYPASS_PERSONAS.lecturer1.user`. */
export const SAML_BYPASS_DEV_LECTURER_USER = SAML_BYPASS_PERSONAS.lecturer1.user;

export function isSamlBypassPersonaId(value: string): value is SamlBypassPersonaId {
  return (SAML_BYPASS_PERSONA_IDS as readonly string[]).includes(value);
}

/** Maps legacy `{ profile: "student" | "lecturer" }` to persona ids. */
export function resolveLegacyBypassProfile(profile: string): SamlBypassPersonaId | null {
  if (profile === 'student') {
    return 'student1';
  }
  if (profile === 'lecturer') {
    return 'lecturer1';
  }
  return null;
}
