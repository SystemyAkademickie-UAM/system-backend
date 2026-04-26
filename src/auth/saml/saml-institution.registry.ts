import * as fs from 'node:fs';
import * as path from 'node:path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SamlConfigService } from './saml-config.service';

const RELAY_STATE_PREFIX = 'maqinst:';

const DEFAULT_LOCAL_PROXY_ENTRY_POINT = 'https://localhost:14443/idp/profile/SAML2/Redirect/SSO';
/** PEM material lives in workspace `secrets/saml/` (outside the backend repo). */
const DEFAULT_LOCAL_PROXY_IDP_CERT_PATH = '../secrets/saml/proxy-idp-signing.pem';
const DEFAULT_UAM_IDP_CERT_PATH = '../secrets/saml/uam-idp-signing.pem';

export type SamlInstitutionListItem = {
  readonly id: string;
  readonly name: string;
  readonly mode: 'ready' | 'planned' | 'needs_config';
};

export type SamlInstitutionBinding = {
  readonly entryPoint: string;
  readonly idpCertPem: string;
};

@Injectable()
export class SamlInstitutionRegistry {
  constructor(
    private readonly config: ConfigService,
    private readonly samlConfig: SamlConfigService,
  ) {}

  static relayStateForInstitution(institutionId: string): string {
    return `${RELAY_STATE_PREFIX}${encodeURIComponent(institutionId)}`;
  }

  static parseInstitutionFromRelayState(relayState: string | undefined): string | null {
    if (relayState === undefined || relayState.length === 0) {
      return null;
    }
    const marker = RELAY_STATE_PREFIX;
    const idx = relayState.indexOf(marker);
    if (idx < 0) {
      return null;
    }
    const raw = relayState.slice(idx + marker.length).split('&')[0] ?? '';
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }

  /**
   * Public list for the SPA institution step (PIONIER.id is shown as planned until DS is wired).
   */
  listForDisplay(samlReady: boolean): SamlInstitutionListItem[] {
    const rows: SamlInstitutionListItem[] = [
      { id: 'pionier', name: 'PIONIER.id (federacja krajowa)', mode: 'planned' },
    ];
    if (samlReady) {
      rows.push({ id: 'local-proxy', name: 'Środowisko lokalne — Shibboleth (dev)', mode: 'ready' });
      rows.push({
        id: 'uam',
        name: 'Uniwersytet im. Adama Mickiewicza w Poznaniu',
        mode: this.isUamBindingConfigured() ? 'ready' : 'needs_config',
      });
    }
    return rows;
  }

  isKnownInstitutionId(id: string): boolean {
    if (id === 'local-proxy') {
      return true;
    }
    if (id === 'uam') {
      return this.isUamBindingConfigured();
    }
    return false;
  }

  resolveBinding(institutionId: string): SamlInstitutionBinding | null {
    if (institutionId === 'local-proxy') {
      const entryPoint =
        this.config.get<string>('SAML_LOCAL_PROXY_ENTRY_POINT')?.trim() ||
        this.config.get<string>('SAML_ENTRY_POINT')?.trim() ||
        DEFAULT_LOCAL_PROXY_ENTRY_POINT;
      const explicitProxyCert = this.config.get<string>('SAML_LOCAL_PROXY_IDP_CERT_PATH')?.trim();
      let idpCertPem: string | undefined;
      if (explicitProxyCert !== undefined && explicitProxyCert.length > 0) {
        idpCertPem = this.readPemFromPath(explicitProxyCert);
      }
      if (idpCertPem === undefined) {
        idpCertPem = this.readPemFromPath(DEFAULT_LOCAL_PROXY_IDP_CERT_PATH);
      }
      if (idpCertPem === undefined) {
        idpCertPem = this.samlConfig.getIdpCert();
      }
      if (idpCertPem === undefined || idpCertPem.length === 0) {
        return null;
      }
      return { entryPoint, idpCertPem };
    }
    if (institutionId === 'uam' && this.isUamBindingConfigured()) {
      const entryPoint = this.config.get<string>('SAML_UAM_ENTRY_POINT')?.trim() ?? '';
      const certPath = this.config.get<string>('SAML_UAM_IDP_CERT_PATH')?.trim() ?? '';
      const idpCertPem = this.readPemFromPath(certPath);
      if (idpCertPem === undefined) {
        return null;
      }
      return { entryPoint, idpCertPem };
    }
    return null;
  }

  private isUamBindingConfigured(): boolean {
    const ep = this.config.get<string>('SAML_UAM_ENTRY_POINT')?.trim();
    const certPath =
      this.config.get<string>('SAML_UAM_IDP_CERT_PATH')?.trim() || DEFAULT_UAM_IDP_CERT_PATH;
    if (ep === undefined || ep.length === 0) {
      return false;
    }
    return this.readPemFromPath(certPath) !== undefined;
  }

  private readPemFromPath(relativeOrAbsolute: string): string | undefined {
    const resolved = path.isAbsolute(relativeOrAbsolute)
      ? relativeOrAbsolute
      : path.join(process.cwd(), relativeOrAbsolute);
    try {
      const pem = fs.readFileSync(resolved, 'utf-8').trim();
      return pem.length > 0 ? pem : undefined;
    } catch {
      return undefined;
    }
  }
}
