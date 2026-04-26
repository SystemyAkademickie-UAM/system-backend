import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Profile } from '@node-saml/node-saml';
import { Strategy, type VerifiedCallback } from '@node-saml/passport-saml';
import type { Strategy as PassportStrategyType } from 'passport';
import passport from 'passport';

import { SAML_STRATEGY_NAME } from '../../constants/saml-constants';
import { mapSamlProfileToSessionUser } from './saml-profile.mapper';
import { SamlConfigService } from './saml-config.service';
import { isAcceptableSamlSessionUser } from './saml-subject.util';
import type { SamlSessionUser } from './saml.types';

type MutableSamlInternals = {
  options: { entryPoint: string; idpCert: string | string[]; forceAuthn?: boolean };
  pemFiles: unknown[];
};

/**
 * Registers the SAML Passport strategy at startup when environment variables are complete.
 * (Nest's `PassportStrategy` mixin is not compatible with passport-saml's dual verify callbacks.)
 *
 * Supports short-lived rebinding of `entryPoint` + `idpCert` for multi-institution dev flows
 * (RelayState `maqinst:` + ACS). Not safe under concurrent logins to different IdPs.
 */
@Injectable()
export class SamlPassportBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(SamlPassportBootstrapService.name);

  private strategyInstance: Strategy | null = null;

  private baselineEntryPoint: string | undefined;

  private baselineIdpCert: string | undefined;

  constructor(private readonly samlConfig: SamlConfigService) {}

  onModuleInit(): void {
    if (!this.samlConfig.isConfigurationComplete()) {
      this.logger.warn(
        'SAML is not fully configured — auth/saml routes return 503 until env is set. See docs/api/api.md.',
      );
      return;
    }
    try {
      const options = this.samlConfig.buildPassportSamlOptions();
      this.baselineEntryPoint = options.entryPoint;
      const idp = options.idpCert;
      this.baselineIdpCert = typeof idp === 'string' ? idp : Array.isArray(idp) ? idp.join('\n') : String(idp);

      const signonVerify = (profile: Profile | null, done: VerifiedCallback): void => {
        const user: SamlSessionUser = mapSamlProfileToSessionUser(profile);
        if (!isAcceptableSamlSessionUser(user)) {
          done(new Error('SAML subject missing or unusable for session'));
          return;
        }
        done(null, { ...user });
      };
      const logoutVerify = (_profile: Profile | null, done: VerifiedCallback): void => {
        done(null, undefined);
      };
      this.strategyInstance = new Strategy(options, signonVerify, logoutVerify);
      passport.use(SAML_STRATEGY_NAME, this.strategyInstance as unknown as PassportStrategyType);
      this.logger.log('Passport SAML strategy registered.');
    } catch (err) {
      this.logger.error(err instanceof Error ? err.message : err);
    }
  }

  getStrategy(): Strategy | null {
    return this.strategyInstance;
  }

  isReady(): boolean {
    return this.strategyInstance !== null;
  }

  /** Restore env-configured IdP (used before each login without institution, and ACS without maqinst relay). */
  resetToBaseline(): void {
    const saml = this.getMutableSaml();
    if (saml === null || this.baselineEntryPoint === undefined || this.baselineIdpCert === undefined) {
      return;
    }
    saml.options.entryPoint = this.baselineEntryPoint;
    saml.options.idpCert = this.baselineIdpCert;
    saml.pemFiles = [];
  }

  /** Point the SP at a specific IdP before generating AuthnRequest or validating ACS (clears PEM cache). */
  applyBinding(entryPoint: string, idpCertPem: string): void {
    const saml = this.getMutableSaml();
    if (saml === null) {
      return;
    }
    saml.options.entryPoint = entryPoint;
    saml.options.idpCert = idpCertPem;
    saml.pemFiles = [];
  }

  /**
   * Sets SAML `ForceAuthn` on the next AuthnRequest (`@node-saml` reads `options.forceAuthn`).
   * Call with `false` after ACS or for normal logins.
   */
  setForceAuthn(enabled: boolean): void {
    const saml = this.getMutableSaml();
    if (saml === null) {
      return;
    }
    saml.options.forceAuthn = enabled;
  }

  private getMutableSaml(): MutableSamlInternals | null {
    if (this.strategyInstance === null) {
      return null;
    }
    return (this.strategyInstance as unknown as { _saml: MutableSamlInternals })._saml;
  }
}
