import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ValidateInResponseTo, type SamlConfig } from '@node-saml/node-saml';

import type { OrganizationSamlConfig } from './saml-organization-config.service';

@Injectable()
export class SamlConfigService {
  constructor(private readonly config: ConfigService) {}

  getSpEntityId(): string {
    return this.config.getOrThrow<string>('SAML_SP_ENTITY_ID');
  }

  getAcsUrl(): string {
    return this.config.getOrThrow<string>('SAML_ACS_URL');
  }

  getSpPrivateKey(): string {
    const keyPath = this.config.get<string>('SAML_SP_PRIVATE_KEY_PATH');
    const keyInline = this.config.get<string>('SAML_SP_PRIVATE_KEY');
    if (keyInline) {
      return this.normalizePem(keyInline);
    }
    if (keyPath) {
      return this.readPemFile(keyPath);
    }
    throw new Error('SAML_SP_PRIVATE_KEY or SAML_SP_PRIVATE_KEY_PATH required');
  }

  getSpCert(): string {
    const certPath = this.config.get<string>('SAML_SP_CERT_PATH');
    const certInline = this.config.get<string>('SAML_SP_CERT');
    if (certInline) {
      return this.normalizePem(certInline);
    }
    if (certPath) {
      return this.readPemFile(certPath);
    }
    throw new Error('SAML_SP_CERT or SAML_SP_CERT_PATH required');
  }

  getJwtSecret(): string {
    return this.config.getOrThrow<string>('SAML_JWT_SECRET');
  }

  getJwtExpiresIn(): string {
    return this.config.get<string>('SAML_JWT_EXPIRES_IN') || '8h';
  }

  getLoginSuccessUrl(): string {
    return this.config.getOrThrow<string>('SAML_LOGIN_SUCCESS_URL');
  }

  getLogoutUrl(): string {
    return this.config.get<string>('SAML_LOGOUT_URL') || this.getLoginSuccessUrl();
  }

  /**
   * Builds a post-logout redirect URL from a relative SPA path (e.g. `/welcome?loggedOut=1`).
   * Falls back to {@link getLogoutUrl} when the path is invalid.
   */
  resolvePostLogoutRedirect(relativePath: unknown): string {
    if (typeof relativePath !== 'string') {
      return this.getLogoutUrl();
    }
    const trimmed = relativePath.trim();
    if (trimmed === '' || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
      return this.getLogoutUrl();
    }
    try {
      const successUrl = new URL(this.getLoginSuccessUrl());
      return `${successUrl.origin}${trimmed}`;
    } catch {
      return this.getLogoutUrl();
    }
  }

  getSloCallbackUrl(): string {
    const baseUrl = this.getAcsUrl().replace('/acs', '/slo');
    return this.config.get<string>('SAML_SLO_CALLBACK_URL') || baseUrl;
  }

  /**
   * Build passport-saml configuration for a specific organization IdP.
   */
  buildSamlConfigForOrganization(orgConfig: OrganizationSamlConfig): SamlConfig {
    return {
      callbackUrl: this.getAcsUrl(),
      entryPoint: orgConfig.entryPoint,
      issuer: this.getSpEntityId(),
      idpCert: orgConfig.idpCert,
      privateKey: this.getSpPrivateKey(),
      publicCert: this.getSpCert(),
      identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
      disableRequestedAuthnContext: true,
      acceptedClockSkewMs: 5000,
      validateInResponseTo: ValidateInResponseTo.never,
      logoutUrl: orgConfig.logoutUrl,
      logoutCallbackUrl: this.getSloCallbackUrl(),
    };
  }

  /** Minimal config for SP metadata generation (IdP fields are placeholders). */
  buildSpMetadataSamlConfig(): SamlConfig {
    return {
      callbackUrl: this.getAcsUrl(),
      entryPoint: 'http://localhost.invalid/sso',
      issuer: this.getSpEntityId(),
      idpCert: this.getSpCert(),
      privateKey: this.getSpPrivateKey(),
      publicCert: this.getSpCert(),
      identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
      disableRequestedAuthnContext: true,
      acceptedClockSkewMs: 5000,
      validateInResponseTo: ValidateInResponseTo.never,
      logoutCallbackUrl: this.getSloCallbackUrl(),
    };
  }

  isConfigured(): boolean {
    try {
      this.getSpEntityId();
      this.getAcsUrl();
      this.getSpPrivateKey();
      this.getSpCert();
      this.getJwtSecret();
      this.getLoginSuccessUrl();
      return true;
    } catch {
      return false;
    }
  }

  private readPemFile(filePath: string): string {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    return this.normalizePem(fs.readFileSync(absolutePath, 'utf-8'));
  }

  private normalizePem(pem: string): string {
    return pem
      .replace(/^\uFEFF/, '')
      .replace(/\\n/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }
}
