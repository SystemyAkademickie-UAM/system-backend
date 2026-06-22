import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Profile } from '@node-saml/node-saml';

import { LECTURER_ROLE_NAME, STUDENT_ROLE_NAME } from '../../constants/role-name-constants';
import { SamlConfigService } from './saml-config.service';
import type { EduPersonAffiliation, SamlUser, SamlSessionPayload } from './saml.types';

/** OID URNs for common eduPerson/SCHAC attributes */
const OID = {
  MAIL: 'urn:oid:0.9.2342.19200300.100.1.3',
  GIVEN_NAME: 'urn:oid:2.5.4.42',
  SURNAME: 'urn:oid:2.5.4.4',
  DISPLAY_NAME: 'urn:oid:2.16.840.1.113730.3.1.241',
  COMMON_NAME: 'urn:oid:2.5.4.3',
  EDU_PERSON_PRINCIPAL_NAME: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.6',
  SCHAC_PERSONAL_UNIQUE_CODE: 'urn:oid:1.3.6.1.4.1.25178.1.2.14',
  EDU_PERSON_AFFILIATION: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.1',
  EDU_PERSON_SCOPED_AFFILIATION: 'urn:oid:1.3.6.1.4.1.5923.1.1.1.9',
};

/** Valid eduPersonAffiliation values per REFEDS standard */
const VALID_AFFILIATIONS = new Set<EduPersonAffiliation>([
  'student',
  'faculty',
  'staff',
  'employee',
  'member',
  'affiliate',
  'alum',
  'library-walk-in',
]);

@Injectable()
export class SamlService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly samlConfig: SamlConfigService) {}

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
    
    const affiliations = this.extractAffiliations(attrs);
    const role = this.mapAffiliationsToRole(affiliations);

    return {
      nameId: profile.nameID || eppn || email || 'unknown',
      nameIdFormat: profile.nameIDFormat,
      sessionIndex: profile.sessionIndex,
      email,
      givenName,
      surname,
      displayName: displayName || `${givenName || ''} ${surname || ''}`.trim() || undefined,
      eduPersonPrincipalName: eppn,
      schacPersonalUniqueCode: schacCode,
      affiliations: affiliations.length > 0 ? affiliations : undefined,
      role,
    };
  }

  signSessionToken(user: SamlUser, organizationId?: number, userId?: number): string {
    const payload: SamlSessionPayload = {
      sub: user.nameId,
      nameIdFormat: user.nameIdFormat,
      sessionIndex: user.sessionIndex,
      email: user.email,
      givenName: user.givenName,
      surname: user.surname,
      displayName: user.displayName,
      affiliations: user.affiliations,
      role: user.role,
      organizationId,
      userId,
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

  /**
   * Extract eduPersonAffiliation values from SAML attributes.
   * Handles both eduPersonAffiliation and eduPersonScopedAffiliation (strips scope).
   */
  private extractAffiliations(attrs: Record<string, unknown>): EduPersonAffiliation[] {
    const result: EduPersonAffiliation[] = [];
    const seen = new Set<string>();

    const processValue = (val: unknown): void => {
      if (typeof val === 'string' && val.length > 0) {
        // eduPersonScopedAffiliation has format "affiliation@scope" — extract affiliation part
        const affiliation = val.includes('@') ? val.split('@')[0] : val;
        const normalized = affiliation.toLowerCase() as EduPersonAffiliation;
        if (VALID_AFFILIATIONS.has(normalized) && !seen.has(normalized)) {
          seen.add(normalized);
          result.push(normalized);
        }
      }
    };

    const keys = [
      'eduPersonAffiliation',
      OID.EDU_PERSON_AFFILIATION,
      'eduPersonScopedAffiliation',
      OID.EDU_PERSON_SCOPED_AFFILIATION,
    ];

    for (const key of keys) {
      const val = attrs[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          processValue(item);
        }
      } else {
        processValue(val);
      }
    }

    return result;
  }

  /**
   * Map IdP affiliations to system role.
   * Priority: faculty/staff/employee → lecturer, student → student.
   * If multiple apply, faculty/staff roles take precedence.
   */
  private mapAffiliationsToRole(affiliations: EduPersonAffiliation[]): string | undefined {
    if (affiliations.length === 0) {
      return undefined;
    }
    // Faculty, staff, or employee → lecturer role
    if (
      affiliations.includes('faculty') ||
      affiliations.includes('staff') ||
      affiliations.includes('employee')
    ) {
      return LECTURER_ROLE_NAME;
    }
    // Student affiliation → student role
    if (affiliations.includes('student')) {
      return STUDENT_ROLE_NAME;
    }
    // Other affiliations (member, affiliate, alum, library-walk-in) — no specific role
    return undefined;
  }
}
