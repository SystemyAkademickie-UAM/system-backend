import { SAML_RELAY_STATE_ORG_PREFIX } from '../../constants/saml-constants';

export type ParsedSamlRelayState = {
  organizationId: number;
  /** @deprecated Browser ID is no longer used; always null. */
  browserId: null;
};

/**
 * Formats a SAML RelayState string containing the organization ID.
 * Browser ID has been removed as part of the session rewrite.
 */
export function formatSamlRelayState(organizationId: number): string {
  return `${SAML_RELAY_STATE_ORG_PREFIX}${organizationId}`;
}

/**
 * Parses a legacy SAML RelayState string to extract the organization ID.
 * Browser ID is ignored even if present (backward compatibility for in-flight SSO).
 */
export function parseSamlRelayState(raw: unknown): ParsedSamlRelayState | null {
  const value = String(raw ?? '').trim();
  if (!value.startsWith(SAML_RELAY_STATE_ORG_PREFIX)) {
    return null;
  }
  const withoutOrgPrefix = value.slice(SAML_RELAY_STATE_ORG_PREFIX.length);
  const pipeIndex = withoutOrgPrefix.indexOf('|');
  const orgPart = pipeIndex >= 0 ? withoutOrgPrefix.slice(0, pipeIndex) : withoutOrgPrefix;
  const organizationId = Number.parseInt(orgPart, 10);
  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    return null;
  }
  return { organizationId, browserId: null };
}
