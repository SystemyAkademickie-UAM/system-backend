import type { Profile } from '@node-saml/node-saml';

import type { SamlSessionUser } from './saml.types';

const URN_MAIL = 'urn:oid:0.9.2342.19200300.100.1.3';
const URN_DISPLAY_NAME = 'urn:oid:2.16.840.1.113730.3.1.241';
const URN_EPPN = 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6';
const URN_UID = 'urn:oid:0.9.2342.19200300.100.1.1';
const URN_GIVEN_NAME = 'urn:oid:2.5.4.42';
const URN_SN = 'urn:oid:2.5.4.4';

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

  const givenName = pickString('givenName', URN_GIVEN_NAME);
  const surname = pickString('sn', 'surname', URN_SN);
  const uid = pickString('uid', URN_UID);

  const composedFullName = [givenName, surname].filter(Boolean).join(' ').trim();
  const displayName =
    pickString('displayName', 'display_name', 'cn', URN_DISPLAY_NAME) ??
    (composedFullName.length > 0 ? composedFullName : undefined) ??
    givenName ??
    email;

  const eppn = pickString('eduPersonPrincipalName', URN_EPPN);

  const keys = Object.keys(attrs).sort();

  return {
    nameId: nameId || eppn || email || uid || 'unknown',
    email: email ?? eppn,
    displayName,
    givenName,
    surname,
    uid,
    rawProfileKeys: keys,
  };
}
