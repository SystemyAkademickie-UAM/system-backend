import type { Profile } from '@node-saml/node-saml';

import { mapSamlProfileToSessionUser } from './saml-profile.mapper';

describe('mapSamlProfileToSessionUser', () => {
  it('maps nameID and mail attributes', () => {
    const profile = {
      nameID: 'user@univ.example.org',
      attributes: {
        mail: ['student@uam.edu.pl'],
        displayName: ['Jan Kowalski'],
      },
    } as unknown as Profile;

    const user = mapSamlProfileToSessionUser(profile);

    expect(user.nameId).toBe('user@univ.example.org');
    expect(user.email).toBe('student@uam.edu.pl');
    expect(user.displayName).toBe('Jan Kowalski');
    expect(user.rawProfileKeys.length).toBeGreaterThan(0);
  });

  it('handles null profile', () => {
    const user = mapSamlProfileToSessionUser(null);
    expect(user.nameId).toBe('');
    expect(user.rawProfileKeys).toEqual([]);
  });
});
