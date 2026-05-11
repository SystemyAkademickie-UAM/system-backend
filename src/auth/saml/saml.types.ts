/**
 * User session data stored in JWT after successful SAML authentication.
 * Maps to eduPerson / SCHAC attributes from PIONIER.id federation.
 */
export interface SamlUser {
  readonly nameId: string;
  readonly nameIdFormat?: string;
  readonly sessionIndex?: string;
  readonly email?: string;
  readonly givenName?: string;
  readonly surname?: string;
  readonly displayName?: string;
  readonly studentId?: string;
  readonly eduPersonPrincipalName?: string;
  readonly schacPersonalUniqueCode?: string;
}

export interface SamlSessionPayload {
  sub: string;
  nameIdFormat?: string;
  sessionIndex?: string;
  email?: string;
  givenName?: string;
  surname?: string;
  displayName?: string;
  studentId?: string;
}
