import { isAcceptableSamlSessionUser } from './saml-subject.util';
import type { SamlSessionUser } from './saml.types';

describe('isAcceptableSamlSessionUser', () => {
  it('returns false for empty nameId', () => {
    const user: SamlSessionUser = {
      nameId: '',
      rawProfileKeys: [],
    };
    expect(isAcceptableSamlSessionUser(user)).toBe(false);
  });

  it('returns false for unknown placeholder', () => {
    const user: SamlSessionUser = {
      nameId: 'unknown',
      rawProfileKeys: [],
    };
    expect(isAcceptableSamlSessionUser(user)).toBe(false);
  });

  it('returns true for non-empty subject', () => {
    const user: SamlSessionUser = {
      nameId: '_7b3f8e2c transient example',
      email: 'u@amu.edu.pl',
      rawProfileKeys: [],
    };
    expect(isAcceptableSamlSessionUser(user)).toBe(true);
  });
});
