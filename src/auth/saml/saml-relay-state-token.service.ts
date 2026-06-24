import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { SAML_PENDING_ORG_COOKIE_MAX_AGE_MS } from '../../constants/saml-constants';

export type PendingSamlLoginContext = {
  organizationId: number;
  /** @deprecated Browser ID is no longer used; always null. */
  browserId: null;
};

type RelayStateJwtPayload = {
  purpose: 'saml-pending-login';
  organizationId: number;
};

const RELAY_STATE_JWT_PURPOSE = 'saml-pending-login';
const RELAY_STATE_TTL_SECONDS = Math.floor(SAML_PENDING_ORG_COOKIE_MAX_AGE_MS / 1000);

/**
 * Signed RelayState token — self-contained, survives IdP round-trip without cookies or server-side store.
 * Browser ID has been removed as part of the session rewrite.
 */
@Injectable()
export class SamlRelayStateTokenService {
  constructor(private readonly jwtService: JwtService) {}

  createRelayStateToken(organizationId: number, _browserId: null): string {
    const payload: RelayStateJwtPayload = {
      purpose: RELAY_STATE_JWT_PURPOSE,
      organizationId,
    };
    return this.jwtService.sign(payload, { expiresIn: RELAY_STATE_TTL_SECONDS });
  }

  parseRelayStateToken(raw: unknown): PendingSamlLoginContext | null {
    const token = String(raw ?? '').trim();
    if (token === '') {
      return null;
    }
    let payload: RelayStateJwtPayload;
    try {
      payload = this.jwtService.verify<RelayStateJwtPayload>(token);
    } catch {
      return null;
    }
    if (payload.purpose !== RELAY_STATE_JWT_PURPOSE) {
      return null;
    }
    const organizationId = payload.organizationId;
    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      return null;
    }
    return { organizationId, browserId: null };
  }
}
