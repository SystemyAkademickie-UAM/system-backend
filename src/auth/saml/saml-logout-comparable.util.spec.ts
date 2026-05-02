import type { Profile } from '@node-saml/node-saml';

import { SAML_LOGOUT_FALLBACK_NAME_ID_FORMAT } from '../../constants/saml-constants';
import type { SamlSessionJwtPayload } from './saml-auth.service';
import {
  toComparableLogoutProfileFromIdpRequest,
  toComparableLogoutProfileFromJwt,
} from './saml-logout-comparable.util';

describe('saml-logout-comparable', () => {
  it('JWT payload maps to Profile fields expected by node-saml logout', () => {
    const payload: SamlSessionJwtPayload = {
      sub: 'user@example.edu',
      idpIssuer: 'https://sso.example.edu/idp',
      nameIDFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
      sessionIndex: '_abc123',
    };
    const p = toComparableLogoutProfileFromJwt(payload);
    expect(p.nameID).toBe('user@example.edu');
    expect(p.issuer).toBe('https://sso.example.edu/idp');
    expect(p.nameIDFormat).toBe(payload.nameIDFormat);
    expect(p.sessionIndex).toBe('_abc123');
  });

  it('JWT without optional SAML fields uses fallback NameIDFormat', () => {
    const payload: SamlSessionJwtPayload = { sub: 'x' };
    const p = toComparableLogoutProfileFromJwt(payload);
    expect(p.nameIDFormat).toBe(SAML_LOGOUT_FALLBACK_NAME_ID_FORMAT);
    expect(p.issuer).toBe('');
  });

  it('IdP LogoutRequest profile is trimmed consistently', () => {
    const profile = {
      issuer: 'https://idp',
      nameID: 'n',
      nameIDFormat: undefined,
      sessionIndex: 's',
      extra: 'ignored',
    } as unknown as Profile;
    const p = toComparableLogoutProfileFromIdpRequest(profile);
    expect(p).toEqual({
      issuer: 'https://idp',
      nameID: 'n',
      nameIDFormat: SAML_LOGOUT_FALLBACK_NAME_ID_FORMAT,
      sessionIndex: 's',
      nameQualifier: undefined,
      spNameQualifier: undefined,
    });
  });
});
