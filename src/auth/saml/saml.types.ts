/**
 * Minimal session identity persisted in the post-SAML JWT.
 * Align attribute mapping with your IdP (e.g. UAM / PIONIER) during integration.
 */
export type SamlSessionUser = {
  readonly nameId: string;
  readonly email?: string;
  readonly displayName?: string;
  /** Given name / first name from IdP attributes when present. */
  readonly givenName?: string;
  /** Family name from IdP attributes when present. */
  readonly surname?: string;
  /** Login or LDAP uid when asserted (federation-dependent). */
  readonly uid?: string;
  readonly rawProfileKeys: readonly string[];
};
