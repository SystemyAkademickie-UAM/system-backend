/**
 * eduPersonAffiliation values from SAML IdP.
 * @see https://wiki.refeds.org/display/STAN/eduPerson
 */
export type EduPersonAffiliation =
  | 'student'
  | 'faculty'
  | 'staff'
  | 'employee'
  | 'member'
  | 'affiliate'
  | 'alum'
  | 'library-walk-in';

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
  readonly eduPersonPrincipalName?: string;
  readonly schacPersonalUniqueCode?: string;
  /** Raw eduPersonAffiliation values from IdP (e.g. ["student", "member"]). */
  readonly affiliations?: readonly EduPersonAffiliation[];
  /** Derived system role based on affiliations (student | lecturer | administrator). */
  readonly role?: string;
}

export interface SamlSessionPayload {
  sub: string;
  nameIdFormat?: string;
  sessionIndex?: string;
  email?: string;
  givenName?: string;
  surname?: string;
  displayName?: string;
  /** Raw eduPersonAffiliation values from IdP. */
  affiliations?: readonly EduPersonAffiliation[];
  /** Derived system role (student | lecturer | administrator). */
  role?: string;
}
