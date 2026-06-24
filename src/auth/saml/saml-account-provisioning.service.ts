import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AccountEntity } from '../../database/entities/account.entity';
import { SuperAdminBootstrapService } from '../../admin/bootstrap/super-admin-bootstrap.service';
import { SamlLinkedUserService } from '../login/saml-linked-user.service';
import type { SamlSessionPayload } from './saml.types';

/**
 * Provisions `auth.users` and `auth.accounts` after SAML ACS for the selected organization.
 */
@Injectable()
export class SamlAccountProvisioningService {
  private readonly logger = new Logger(SamlAccountProvisioningService.name);

  constructor(
    private readonly samlLinkedUserService: SamlLinkedUserService,
    private readonly superAdminBootstrapService: SuperAdminBootstrapService,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>) {}

  async provisionFromSamlSession(payload: SamlSessionPayload, organizationId: number): Promise<number> {
    const userId = await this.samlLinkedUserService.findOrCreateFromSamlSession(payload);
    await this.superAdminBootstrapService.tryGrantBootstrapSuperOnLogin(userId, payload.email);
    const role = payload.role?.trim();
    if (role === undefined || role === '') {
      this.logger.warn(`SAML provisioning: no mappable role for userId=${userId} org=${organizationId}`);
      return userId;
    }
    const existing = await this.accountRepository.findOne({
      where: { userId, organizationId, role },
    });
    if (existing !== null) {
      return userId;
    }
    const row = this.accountRepository.create({ userId, organizationId, role });
    await this.accountRepository.save(row);
    this.logger.log(`Provisioned auth.accounts userId=${userId} org=${organizationId} role=${role}`);
    return userId;
  }
}
