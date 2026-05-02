/**
 * Minimal session identity persisted in the post-SAML JWT.
 * Align attribute mapping with your IdP (e.g. UAM / PIONIER) during integration.
 */
export type SamlSessionUser = {
  readonly nameId: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly rawProfileKeys: readonly string[];
  /** From SAML assertion — required for SP-initiated single logout. */
  readonly nameIDFormat?: string;
  readonly sessionIndex?: string;
  readonly nameQualifier?: string;
  readonly spNameQualifier?: string;
  /** SAML assertion issuer (IdP entity ID). */
  readonly idpIssuer?: string;
};
