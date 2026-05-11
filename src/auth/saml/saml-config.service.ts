import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ValidateInResponseTo, type SamlConfig } from '@node-saml/node-saml';

@Injectable()
export class SamlConfigService {
  constructor(private readonly config: ConfigService) {}

  getSpEntityId(): string {
    return this.config.getOrThrow<string>('SAML_SP_ENTITY_ID');
  }

  getAcsUrl(): string {
    return this.config.getOrThrow<string>('SAML_ACS_URL');
  }

  getIdpEntryPoint(): string {
    return this.config.getOrThrow<string>('SAML_IDP_ENTRY_POINT');
  }

  getIdpCert(): string {
    const certPath = this.config.get<string>('SAML_IDP_CERT_PATH');
    const certInline = this.config.get<string>('SAML_IDP_CERT');
    
    if (certInline) {
      return this.normalizePem(certInline);
    }
    if (certPath) {
      return this.readPemFile(certPath);
    }
    throw new Error('SAML_IDP_CERT or SAML_IDP_CERT_PATH required');
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

  getIdpLogoutUrl(): string | undefined {
    return this.config.get<string>('SAML_IDP_LOGOUT_URL');
  }

  getSloCallbackUrl(): string {
    const baseUrl = this.getAcsUrl().replace('/acs', '/slo');
    return this.config.get<string>('SAML_SLO_CALLBACK_URL') || baseUrl;
  }

  /**
   * Build passport-saml configuration matching PIONIER.id requirements.
   * - Signed AuthnRequest (SHA-256)
   * - Transient NameID format
   * - Signed assertions required
   * - HTTP-Redirect for AuthnRequest, HTTP-POST for ACS
   */
  buildSamlConfig(): SamlConfig {
    return {
      callbackUrl: this.getAcsUrl(),
      entryPoint: this.getIdpEntryPoint(),
      issuer: this.getSpEntityId(),
      idpCert: this.getIdpCert(),
      privateKey: this.getSpPrivateKey(),
      publicCert: this.getSpCert(),
      
      // PIONIER.id: transient NameID format (typical for eduGAIN)
      identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
      
      // Signed AuthnRequest with SHA-256 (PIONIER requirement)
      signatureAlgorithm: 'sha256',
      digestAlgorithm: 'sha256',
      
      // Require signed assertions (security requirement)
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: true,
      
      // Do not request specific authn context (let IdP decide)
      disableRequestedAuthnContext: true,
      
      // Clock skew tolerance (5 seconds)
      acceptedClockSkewMs: 5000,
      
      // Validate InResponseTo - disabled for test IdP compatibility
      validateInResponseTo: ValidateInResponseTo.never,
      
      // Single Logout (SLO) configuration
      logoutUrl: this.getIdpLogoutUrl(),
      logoutCallbackUrl: this.getSloCallbackUrl(),
    };
  }

  isConfigured(): boolean {
    try {
      this.getSpEntityId();
      this.getAcsUrl();
      this.getIdpEntryPoint();
      this.getIdpCert();
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
