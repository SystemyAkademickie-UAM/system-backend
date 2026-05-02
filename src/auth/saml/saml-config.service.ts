import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';

import type { PassportSamlConfig } from '@node-saml/passport-saml';
import { ValidateInResponseTo } from '@node-saml/node-saml';

import {
  SAML_DEFAULT_UAM_IDP_SINGLE_LOGOUT_SERVICE_URL,
  SAML_METADATA_INCLUDE_ARTIFACT_ACS_ENV_KEY,
  SAML_SESSION_JWT_EXPIRES_IN,
} from '../../constants/saml-constants';
import type { SamlSpMetadataTechnicalContact } from './saml-sp-metadata.generator';

function readPemFromEnv(valueKey: string, pathKey: string, config: ConfigService): string | undefined {
  const inline = config.get<string>(valueKey)?.trim();
  if (inline !== undefined && inline.length > 0) {
    return inline.replace(/\\n/g, '\n');
  }
  const filePath = config.get<string>(pathKey)?.trim();
  if (filePath === undefined || filePath.length === 0) {
    return undefined;
  }
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

@Injectable()
export class SamlConfigService {
  constructor(private readonly config: ConfigService) {}

  isConfigurationComplete(): boolean {
    const entityId = this.config.get<string>('SAML_SP_ENTITY_ID')?.trim();
    const acsUrl = this.config.get<string>('SAML_ACS_URL')?.trim();
    const entryPoint = this.config.get<string>('SAML_ENTRY_POINT')?.trim();
    const idpCert = this.getIdpCert();
    const spPub = this.getSpPublicCert();
    const spKey = this.getSpPrivateKey();
    const jwtSecret = this.config.get<string>('SAML_SESSION_JWT_SECRET')?.trim();
    return (
      entityId !== undefined &&
      entityId.length > 0 &&
      acsUrl !== undefined &&
      acsUrl.length > 0 &&
      entryPoint !== undefined &&
      entryPoint.length > 0 &&
      idpCert !== undefined &&
      idpCert.length > 0 &&
      spPub !== undefined &&
      spPub.length > 0 &&
      spKey !== undefined &&
      spKey.length > 0 &&
      jwtSecret !== undefined &&
      jwtSecret.length > 0
    );
  }

  getLoginSuccessRedirectUrl(): string {
    const fallback = 'http://127.0.0.1:3000/';
    const fromEnv = this.config.get<string>('SAML_LOGIN_SUCCESS_REDIRECT_URL')?.trim();
    return fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : fallback;
  }

  getSessionJwtSecret(): string {
    const raw = this.config.get<string>('SAML_SESSION_JWT_SECRET')?.trim();
    if (raw === undefined || raw.length === 0) {
      throw new Error('SAML_SESSION_JWT_SECRET is not set');
    }
    return raw;
  }

  getSessionJwtExpiresIn(): string {
    const fromEnv = this.config.get<string>('SAML_SESSION_JWT_EXPIRES_IN')?.trim();
    return fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : SAML_SESSION_JWT_EXPIRES_IN;
  }

  getSpEntityId(): string {
    return this.config.getOrThrow<string>('SAML_SP_ENTITY_ID').trim();
  }

  getAcsUrl(): string {
    return this.config.getOrThrow<string>('SAML_ACS_URL').trim();
  }

  /**
   * IdP single logout service URL (`SingleLogoutService` in IdP metadata).
   * Defaults to UAM SimpleSAMLphp; override with `SAML_IDP_LOGOUT_URL` for other IdPs.
   */
  getIdpLogoutUrl(): string {
    const raw = this.config.get<string>('SAML_IDP_LOGOUT_URL')?.trim();
    return raw !== undefined && raw.length > 0 ? raw : SAML_DEFAULT_UAM_IDP_SINGLE_LOGOUT_SERVICE_URL;
  }

  /**
   * Optional technical contact embedded in SP metadata (`md:ContactPerson`) for IdP admins / SimpleSAMLphp.
   */
  getSpMetadataTechnicalContact(): SamlSpMetadataTechnicalContact | null {
    const email = this.config.get<string>('SAML_METADATA_TECH_CONTACT_EMAIL')?.trim();
    const givenName = this.config.get<string>('SAML_METADATA_TECH_CONTACT_GIVEN_NAME')?.trim();
    if (
      email === undefined ||
      email.length === 0 ||
      givenName === undefined ||
      givenName.length === 0
    ) {
      return null;
    }
    return { givenName, emailAddress: email };
  }

  /**
   * Optional `<md:SingleLogoutService>` Redirect URL in exported SP metadata (must match UAM `default-sp` shape).
   * Point at **`GET /api/auth/saml/logout`** unless you implement full SAML SLO elsewhere.
   */
  getMetadataSloRedirectUrl(): string | undefined {
    const raw = this.config.get<string>('SAML_METADATA_SLO_REDIRECT_URL')?.trim();
    return raw !== undefined && raw.length > 0 ? raw : undefined;
  }

  /**
   * When true, exported metadata includes `AssertionConsumerService` HTTP-Artifact (`index="1"`).
   * Default false (UAM-safe): ACS runtime is POST-only until SOAP artifact resolution exists.
   */
  includeArtifactAssertionConsumerServiceInMetadata(): boolean {
    const raw = this.config.get<string>(SAML_METADATA_INCLUDE_ARTIFACT_ACS_ENV_KEY)?.trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }

  /** Whether `/api/auth/saml/metadata` can return XML (UAM-style template needs SLO URL + technical contact). */
  isMetadataExportReady(): boolean {
    return this.getMetadataSloRedirectUrl() !== undefined && this.getSpMetadataTechnicalContact() !== null;
  }

  getIdpCert(): string | undefined {
    return readPemFromEnv('SAML_IDP_CERT', 'SAML_IDP_CERT_PATH', this.config);
  }

  getSpPublicCert(): string | undefined {
    return readPemFromEnv('SAML_SP_PUBLIC_CERT', 'SAML_SP_PUBLIC_CERT_PATH', this.config);
  }

  getSpPrivateKey(): string | undefined {
    return readPemFromEnv('SAML_SP_PRIVATE_KEY', 'SAML_SP_PRIVATE_KEY_PATH', this.config);
  }

  /**
   * Presence flags for operators (`GET /auth/saml/status`) without treating unreadable paths as “missing env”.
   */
  getRequirementsPresence(): Record<string, boolean> {
    return {
      SAML_SP_ENTITY_ID: Boolean(this.config.get<string>('SAML_SP_ENTITY_ID')?.trim()),
      SAML_ACS_URL: Boolean(this.config.get<string>('SAML_ACS_URL')?.trim()),
      SAML_ENTRY_POINT: Boolean(this.config.get<string>('SAML_ENTRY_POINT')?.trim()),
      SAML_IDP_CERT_OR_PATH: Boolean(
        this.config.get<string>('SAML_IDP_CERT')?.trim() ||
          this.config.get<string>('SAML_IDP_CERT_PATH')?.trim(),
      ),
      SAML_SP_KEYS: Boolean(
        (this.config.get<string>('SAML_SP_PUBLIC_CERT')?.trim() ||
          this.config.get<string>('SAML_SP_PUBLIC_CERT_PATH')?.trim()) &&
          (this.config.get<string>('SAML_SP_PRIVATE_KEY')?.trim() ||
            this.config.get<string>('SAML_SP_PRIVATE_KEY_PATH')?.trim()),
      ),
      SAML_SESSION_JWT_SECRET: Boolean(this.config.get<string>('SAML_SESSION_JWT_SECRET')?.trim()),
      SAML_METADATA_SLO_REDIRECT_URL: Boolean(this.config.get<string>('SAML_METADATA_SLO_REDIRECT_URL')?.trim()),
      SAML_METADATA_TECH_CONTACT: Boolean(
        this.config.get<string>('SAML_METADATA_TECH_CONTACT_EMAIL')?.trim() &&
          this.config.get<string>('SAML_METADATA_TECH_CONTACT_GIVEN_NAME')?.trim(),
      ),
      SAML_METADATA_INCLUDE_ARTIFACT_ACS: this.includeArtifactAssertionConsumerServiceInMetadata(),
    };
  }

  /**
   * Whether PEM material actually loaded (paths readable / inline non-empty).
   * When env `requirements` are true but these are false, fix paths or mount secrets (common in Docker).
   */
  getPemMaterialsLoaded(): {
    idpCert: boolean;
    spPublicCert: boolean;
    spPrivateKey: boolean;
  } {
    const idpCert = this.getIdpCert();
    const spPublicCert = this.getSpPublicCert();
    const spPrivateKey = this.getSpPrivateKey();
    return {
      idpCert: idpCert !== undefined && idpCert.length > 0,
      spPublicCert: spPublicCert !== undefined && spPublicCert.length > 0,
      spPrivateKey: spPrivateKey !== undefined && spPrivateKey.length > 0,
    };
  }

  /**
   * Options passed to `@node-saml/passport-saml` Strategy (extends `SamlConfig`).
   */
  buildPassportSamlOptions(): PassportSamlConfig {
    if (!this.isConfigurationComplete()) {
      throw new Error('SAML environment is incomplete; refusing to build SAML options.');
    }
    const acsUrl = this.config.getOrThrow<string>('SAML_ACS_URL').trim();
    const entryPoint = this.config.getOrThrow<string>('SAML_ENTRY_POINT').trim();
    const idpCert = this.getIdpCert();
    const privateKey = this.getSpPrivateKey();
    const publicCert = this.getSpPublicCert();
    if (idpCert === undefined || privateKey === undefined || publicCert === undefined) {
      throw new Error('SAML certificate or key material resolved to empty content.');
    }

    return {
      passReqToCallback: false,
      callbackUrl: acsUrl,
      entryPoint,
      logoutUrl: this.getIdpLogoutUrl(),
      issuer: this.getSpEntityId(),
      idpCert,
      privateKey,
      publicCert,
      wantAssertionsSigned: true,
      validateInResponseTo: ValidateInResponseTo.always,
      disableRequestedAuthnContext: true,
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
    };
  }
}
