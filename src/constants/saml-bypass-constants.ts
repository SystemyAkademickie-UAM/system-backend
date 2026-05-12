import type { SamlUser } from '../auth/saml/saml.types';

/** `auth.organizations.name` when bypass seeds an organization because none exist. */
export const SAML_BYPASS_SEED_ORGANIZATION_NAME = 'Dev organization (bypass seed)';

/** Stable SAML `sub` / NameID for dev bypass (student). */
export const SAML_BYPASS_DEV_STUDENT_SUB = 'dev-bypass-student';

/** Stable SAML `sub` / NameID for dev bypass (lecturer). */
export const SAML_BYPASS_DEV_LECTURER_SUB = 'dev-bypass-lecturer';

/** Synthetic IdP user for non-production bypass flows. */
export const SAML_BYPASS_DEV_STUDENT_USER: SamlUser = {
  nameId: SAML_BYPASS_DEV_STUDENT_SUB,
  email: 'dev.student@localhost.invalid',
  displayName: 'Dev Student',
};

/** Synthetic IdP user with lecturer wiring (`auth.accounts`). */
export const SAML_BYPASS_DEV_LECTURER_USER: SamlUser = {
  nameId: SAML_BYPASS_DEV_LECTURER_SUB,
  email: 'dev.lecturer@localhost.invalid',
  displayName: 'Dev Lecturer',
};
