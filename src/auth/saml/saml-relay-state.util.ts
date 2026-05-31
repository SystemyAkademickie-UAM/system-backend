import { BROWSER_ID_UUID_REGEX } from '../../constants/browser-id-constants';
import { SAML_RELAY_STATE_ORG_PREFIX } from '../../constants/saml-constants';

export type ParsedSamlRelayState = {
  organizationId: number;
  browserId: string | null;
};

const RELAY_STATE_BROWSER_PREFIX = '|bid:';

export function formatSamlRelayState(organizationId: number, browserId?: string): string {
  const trimmedBrowserId = browserId?.trim() ?? '';
  const relayState = `${SAML_RELAY_STATE_ORG_PREFIX}${organizationId}`;
  if (trimmedBrowserId === '' || !BROWSER_ID_UUID_REGEX.test(trimmedBrowserId)) {
    return relayState;
  }
  return `${relayState}${RELAY_STATE_BROWSER_PREFIX}${trimmedBrowserId}`;
}

export function parseSamlRelayState(raw: unknown): ParsedSamlRelayState | null {
  const value = String(raw ?? '').trim();
  if (!value.startsWith(SAML_RELAY_STATE_ORG_PREFIX)) {
    return null;
  }
  const withoutOrgPrefix = value.slice(SAML_RELAY_STATE_ORG_PREFIX.length);
  const bidIndex = withoutOrgPrefix.indexOf(RELAY_STATE_BROWSER_PREFIX);
  const orgPart = bidIndex >= 0 ? withoutOrgPrefix.slice(0, bidIndex) : withoutOrgPrefix;
  const organizationId = Number.parseInt(orgPart, 10);
  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    return null;
  }
  if (bidIndex < 0) {
    return { organizationId, browserId: null };
  }
  const browserId = withoutOrgPrefix.slice(bidIndex + RELAY_STATE_BROWSER_PREFIX.length).trim();
  if (browserId === '' || !BROWSER_ID_UUID_REGEX.test(browserId)) {
    return { organizationId, browserId: null };
  }
  return { organizationId, browserId };
}
