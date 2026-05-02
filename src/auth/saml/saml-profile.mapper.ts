import type { Profile } from '@node-saml/node-saml';

import { SAML_LOGOUT_FALLBACK_NAME_ID_FORMAT } from '../../constants/saml-constants';

import type { SamlSessionUser } from './saml.types';

const URN_MAIL = 'urn:oid:0.9.2342.19200300.100.1.3';
const URN_DISPLAY_NAME = 'urn:oid:2.16.840.1.113730.3.1.241';
const URN_EPPN = 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6';

/**
 * Maps a passport-saml `Profile` to our internal session user DTO.
 * Attribute names follow common eduPerson / OID usage in academic federations.
 */
export function mapSamlProfileToSessionUser(profile: Profile | null | undefined): SamlSessionUser {
  if (profile == null) {
    return {
      nameId: '',
      rawProfileKeys: [],
    };
  }

  const profileRecord = profile as unknown as Record<string, unknown>;
  const attrs = (profileRecord.attributes ?? profileRecord) as Record<string, unknown>;

  const nameId = String(profile.nameID ?? profile.nameId ?? profileRecord.nameID ?? '');

  const nameIDFormat =
    typeof profile.nameIDFormat === 'string' && profile.nameIDFormat.length > 0
      ? profile.nameIDFormat
      : SAML_LOGOUT_FALLBACK_NAME_ID_FORMAT;

  const sessionIndex =
    typeof profile.sessionIndex === 'string' && profile.sessionIndex.length > 0
      ? profile.sessionIndex
      : undefined;

  const nameQualifier =
    typeof profile.nameQualifier === 'string' && profile.nameQualifier.length > 0
      ? profile.nameQualifier
      : undefined;

  const spNameQualifier =
    typeof profile.spNameQualifier === 'string' && profile.spNameQualifier.length > 0
      ? profile.spNameQualifier
      : undefined;

  const idpIssuer =
    typeof profile.issuer === 'string' && profile.issuer.length > 0 ? profile.issuer : undefined;

  const pickString = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const v = attrs[key];
      if (typeof v === 'string' && v.length > 0) {
        return v;
      }
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') {
        return v[0];
      }
    }
    return undefined;
  };

  const email =
    pickString('email', 'mail', 'Email', URN_MAIL) ??
    (typeof profileRecord.email === 'string' ? profileRecord.email : undefined);

  const displayName =
    pickString('displayName', 'display_name', 'cn', 'givenName', URN_DISPLAY_NAME) ?? email;

  const eppn = pickString('eduPersonPrincipalName', URN_EPPN);

  const keys = Object.keys(attrs).sort();

  return {
    nameId: nameId || eppn || email || 'unknown',
    email: email ?? eppn,
    displayName,
    rawProfileKeys: keys,
    nameIDFormat,
    sessionIndex,
    nameQualifier,
    spNameQualifier,
    idpIssuer,
  };
}
