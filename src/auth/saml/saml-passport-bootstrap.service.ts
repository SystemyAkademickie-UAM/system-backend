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

/**
 * Registers the SAML Passport strategy at startup when environment variables are complete.
 * (Nest's `PassportStrategy` mixin is not compatible with passport-saml's dual verify callbacks.)
 */
@Injectable()
export class SamlPassportBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(SamlPassportBootstrapService.name);

  private strategyInstance: Strategy | null = null;

  constructor(private readonly samlConfig: SamlConfigService) {}

  onModuleInit(): void {
    if (!this.samlConfig.isConfigurationComplete()) {
      this.logger.warn(
        'SAML is not fully configured — auth/saml routes return 503 until env is set. See docs/api.md.',
      );
      return;
    }
    try {
      const options = this.samlConfig.buildPassportSamlOptions();
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
}
