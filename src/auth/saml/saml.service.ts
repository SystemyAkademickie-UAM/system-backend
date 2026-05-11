import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Profile } from '@node-saml/node-saml';

import { SamlConfigService } from './saml-config.service';
import type { SamlUser, SamlSessionPayload } from './saml.types';

/** OID URNs for common eduPerson/SCHAC attributes */
const OID = {
  MAIL: 'urn:oid:0.9.2342.19200300.100.1.3',
  GIVEN_NAME: 'urn:oid:2.5.4.42',
  SURNAME: 'urn:oid:2.5.4.4',
  DISPLAY_NAME: 'urn:oid:2.16.840.1.113730.3.1.241',
  COMMON_NAME: 'urn:oid:2.5.4.3',
  EDU_PERSON_PRINCIPAL_NAME: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6',
  SCHAC_PERSONAL_UNIQUE_CODE: 'urn:oid:1.3.6.1.4.1.25178.1.2.14',
};

@Injectable()
export class SamlService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly samlConfig: SamlConfigService,
  ) {}

  /**
   * Map SAML profile to SamlUser. Handles both friendly names and OID URNs.
   */
  mapProfileToUser(profile: Profile | null): SamlUser | null {
    if (!profile) {
      return null;
    }

    const attrs = (profile as Record<string, unknown>);
    
    const getValue = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        const val = attrs[key];
        if (typeof val === 'string' && val.length > 0) {
          return val;
        }
        if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
          return val[0];
        }
      }
      return undefined;
    };

    const email = getValue('mail', 'email', OID.MAIL);
    const givenName = getValue('givenName', OID.GIVEN_NAME);
    const surname = getValue('sn', 'surname', OID.SURNAME);
    const displayName = getValue('displayName', OID.DISPLAY_NAME, 'cn', OID.COMMON_NAME);
    const eppn = getValue('eduPersonPrincipalName', OID.EDU_PERSON_PRINCIPAL_NAME);
    const schacCode = getValue('schacPersonalUniqueCode', OID.SCHAC_PERSONAL_UNIQUE_CODE);
    
    // Extract student ID from schacPersonalUniqueCode (format: urn:schac:personalUniqueCode:int:esi:pl:XXXX)
    const studentId = this.extractStudentId(schacCode);

    return {
      nameId: profile.nameID || eppn || email || 'unknown',
      nameIdFormat: profile.nameIDFormat,
      sessionIndex: profile.sessionIndex,
      email,
      givenName,
      surname,
      displayName: displayName || `${givenName || ''} ${surname || ''}`.trim() || undefined,
      studentId,
      eduPersonPrincipalName: eppn,
      schacPersonalUniqueCode: schacCode,
    };
  }

  signSessionToken(user: SamlUser): string {
    const payload: SamlSessionPayload = {
      sub: user.nameId,
      nameIdFormat: user.nameIdFormat,
      sessionIndex: user.sessionIndex,
      email: user.email,
      givenName: user.givenName,
      surname: user.surname,
      displayName: user.displayName,
      studentId: user.studentId,
    };
    return this.jwtService.sign(payload as unknown as Record<string, unknown>);
  }

  verifySessionToken(token: string): SamlSessionPayload | null {
    try {
      return this.jwtService.verify<SamlSessionPayload>(token);
    } catch {
      return null;
    }
  }

  private extractStudentId(schacCode?: string): string | undefined {
    if (!schacCode) {
      return undefined;
    }
    // Format: urn:schac:personalUniqueCode:int:esi:pl:STUDENT_ID
    // or: urn:schac:personalUniqueCode:pl:uam.edu.pl:ID:STUDENT_ID
    const parts = schacCode.split(':');
    if (parts.length >= 4) {
      return parts[parts.length - 1];
    }
    return schacCode;
  }
}
