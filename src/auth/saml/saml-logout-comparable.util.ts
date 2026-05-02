import type { Profile } from '@node-saml/node-saml';

import { SAML_LOGOUT_FALLBACK_NAME_ID_FORMAT } from '../../constants/saml-constants';

import type { SamlSessionJwtPayload } from './saml-auth.service';

/** Minimal `Profile` shape used by passport-saml `deepStrictEqual(req.user, logoutUser)` during IdP-initiated SLO. */
export function toComparableLogoutProfileFromJwt(payload: SamlSessionJwtPayload): Profile {
  return {
    issuer: payload.idpIssuer ?? '',
    nameID: payload.sub,
    nameIDFormat: payload.nameIDFormat ?? SAML_LOGOUT_FALLBACK_NAME_ID_FORMAT,
    sessionIndex: payload.sessionIndex,
    nameQualifier: payload.nameQualifier,
    spNameQualifier: payload.spNameQualifier,
  };
}

export function toComparableLogoutProfileFromIdpRequest(profile: Profile): Profile {
  return {
    issuer: profile.issuer,
    nameID: profile.nameID,
    nameIDFormat: profile.nameIDFormat ?? SAML_LOGOUT_FALLBACK_NAME_ID_FORMAT,
    sessionIndex: profile.sessionIndex,
    nameQualifier: profile.nameQualifier,
    spNameQualifier: profile.spNameQualifier,
  };
}
