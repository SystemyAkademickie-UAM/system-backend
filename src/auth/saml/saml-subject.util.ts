import type { SamlSessionUser } from './saml.types';

/**
 * Rejects profiles that would yield an unusable or synthetic subject for session issuance.
 * Transient SAML NameIDs are still acceptable if non-empty; empty / `unknown` are not.
 */
export function isAcceptableSamlSessionUser(user: SamlSessionUser): boolean {
  const subject = user.nameId.trim();
  if (subject.length === 0) {
    return false;
  }
  if (subject === 'unknown') {
    return false;
  }
  return true;
}
