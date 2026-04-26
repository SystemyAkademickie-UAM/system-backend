import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';

import type { PassportSamlConfig } from '@node-saml/passport-saml';
import { ValidateInResponseTo } from '@node-saml/node-saml';

function parseValidateInResponseTo(raw: string | undefined): ValidateInResponseTo {
  const v = raw?.trim().toLowerCase();
  if (v === 'never') {
    return ValidateInResponseTo.never;
  }
  if (v === 'always') {
    return ValidateInResponseTo.always;
  }
  if (v === 'ifpresent' || v === 'if_present') {
    return ValidateInResponseTo.ifPresent;
  }
  return ValidateInResponseTo.ifPresent;
}

import {
  SAML_IDENTIFIER_FORMAT_DEFAULT,
  SAML_SESSION_JWT_EXPIRES_IN,
} from '../../constants/saml-constants';

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
    const fallback = 'http://127.0.0.1:3000/home';
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

  /**
   * How strictly to match SAML `InResponseTo` against the in-memory AuthnRequest cache.
   * Use `never` for local Shibboleth / `npm run start:dev --watch` (restarts clear the cache → ACS 500).
   * Production clusters should prefer `ifPresent` or `always` with a shared `cacheProvider`.
   */
  getValidateInResponseTo(): ValidateInResponseTo {
    return parseValidateInResponseTo(this.config.get<string>('SAML_VALIDATE_IN_RESPONSE_TO'));
  }

  /**
   * SAML NameIDPolicy `@Format` sent on AuthnRequest. Shibboleth dev IdP only supports **transient**
   * in metadata — `emailAddress` (node-saml default) yields `InvalidNameIDPolicy` on the Response.
   */
  getIdentifierFormat(): string {
    const fromEnv = this.config.get<string>('SAML_IDENTIFIER_FORMAT')?.trim();
    return fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : SAML_IDENTIFIER_FORMAT_DEFAULT;
  }

  getSpEntityId(): string {
    return this.config.getOrThrow<string>('SAML_SP_ENTITY_ID').trim();
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
      issuer: this.getSpEntityId(),
      identifierFormat: this.getIdentifierFormat(),
      idpCert,
      privateKey,
      publicCert,
      /**
       * Both **false**: `@node-saml` verifies a **Response** signature if present, otherwise the **Assertion**
       * signature (`validatePostResponseAsync`: `wantAssertionsSigned || !validSignature`).
       * Shibboleth IdP 3 often signs the **outer Response only**; `wantAssertionsSigned: true` then fails ACS
       * with `Invalid signature` because the Assertion has no `ds:Signature` child.
       */
      wantAssertionsSigned: false,
      wantAuthnResponseSigned: false,
      validateInResponseTo: this.getValidateInResponseTo(),
      disableRequestedAuthnContext: true,
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
    };
  }
}
