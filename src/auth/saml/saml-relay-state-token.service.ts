import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { BROWSER_ID_UUID_REGEX } from '../../constants/browser-id-constants';
import { SAML_PENDING_ORG_COOKIE_MAX_AGE_MS } from '../../constants/saml-constants';

export type PendingSamlLoginContext = {
  organizationId: number;
  browserId: string | null;
};

type RelayStateJwtPayload = {
  purpose: 'saml-pending-login';
  organizationId: number;
  browserId?: string;
};

const RELAY_STATE_JWT_PURPOSE = 'saml-pending-login';
const RELAY_STATE_TTL_SECONDS = Math.floor(SAML_PENDING_ORG_COOKIE_MAX_AGE_MS / 1000);

/**
 * Signed RelayState token — self-contained, survives IdP round-trip without cookies or server-side store.
 */
@Injectable()
export class SamlRelayStateTokenService {
  constructor(private readonly jwtService: JwtService) {}

  createRelayStateToken(organizationId: number, browserId: string | null): string {
    const payload: RelayStateJwtPayload = {
      purpose: RELAY_STATE_JWT_PURPOSE,
      organizationId,
    };
    if (browserId !== null && BROWSER_ID_UUID_REGEX.test(browserId)) {
      payload.browserId = browserId;
    }
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
    const browserIdRaw = payload.browserId?.trim() ?? '';
    const browserId =
      browserIdRaw !== '' && BROWSER_ID_UUID_REGEX.test(browserIdRaw) ? browserIdRaw : null;
    return { organizationId, browserId };
  }
}
