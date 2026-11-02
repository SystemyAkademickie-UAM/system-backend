import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ROLE_PRIORITY_ORDER } from '../../constants/role-name-constants';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { SessionIssuanceService } from '../session/session-issuance.service';

/** Active organization and the roles the user holds there. */
export type LoginMembership = {
  organizationId: number;
  name: string;
  roles: string[];
};

type MembershipRow = {
  organizationId?: string | number;
  organizationid?: string | number;
  name: string;
  role: string;
};

type LoginPair = {
  organizationId: number;
  role: string;
};

/**
 * Chooses the organization and role for a session, and remembers the last confirmed pair.
 */
@Injectable()
export class LoginContextService {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly sessionIssuanceService: SessionIssuanceService,
  ) {}

  /**
   * Active memberships grouped by organization. Inactive organizations are omitted.
   */
  async listMemberships(userId: number): Promise<LoginMembership[]> {
    const rows = await this.accountRepository
      .createQueryBuilder('account')
      .innerJoin(
        OrganizationEntity,
        'organization',
        'organization.id = account.organization_id',
      )
      .select('account.organization_id', 'organizationId')
      .addSelect('organization.name', 'name')
      .addSelect('account.role', 'role')
      .where('account.user_id = :userId', { userId })
      .andWhere('organization.is_active = true')
      .getRawMany<MembershipRow>();

    const byOrganization = new Map<number, LoginMembership>();
    for (const row of rows) {
      const organizationId = Number(row.organizationId ?? row.organizationid);
      if (!Number.isInteger(organizationId)) {
        continue;
      }
      const existing = byOrganization.get(organizationId);
      if (!existing) {
        byOrganization.set(organizationId, {
          organizationId,
          name: row.name,
          roles: [row.role],
        });
        continue;
      }
      if (!existing.roles.includes(row.role)) {
        existing.roles.push(row.role);
      }
    }

    const memberships = [...byOrganization.values()].sort(
      (left, right) => left.organizationId - right.organizationId,
    );
    for (const membership of memberships) {
      membership.roles.sort((left, right) => this.roleRank(left) - this.roleRank(right));
    }
    return memberships;
  }

  /**
   * Applies a remembered pair, or the only available pair.
   * Several pairs and no memory leave the session waiting for an explicit choice.
   */
  async applyOnLogin(
    plaintextSession: string,
    userId: number,
    loginOrganizationId: number | null,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const memberships = await this.listMemberships(userId);
    const remembered = this.findPair(
      memberships,
      user?.lastOrganizationId ?? null,
      user?.lastRole ?? null,
    );
    if (remembered) {
      await this.sessionIssuanceService.setLoginContext(
        plaintextSession,
        remembered.organizationId,
        remembered.role,
      );
      return;
    }

    const pairs = this.flatten(memberships);
    if (pairs.length === 1) {
      await this.sessionIssuanceService.setLoginContext(
        plaintextSession,
        pairs[0].organizationId,
        pairs[0].role,
      );
      await this.remember(userId, pairs[0].organizationId, pairs[0].role);
      return;
    }

    const loginOrganization = memberships.find(
      (membership) => membership.organizationId === loginOrganizationId,
    );
    if (!loginOrganization) {
      return;
    }
    const role = loginOrganization.roles.length === 1 ? loginOrganization.roles[0] : null;
    await this.sessionIssuanceService.setLoginContext(
      plaintextSession,
      loginOrganization.organizationId,
      role,
    );
  }

  /**
   * Whether the user still has to confirm an organization and role.
   * A single pair never asks. A remembered pair asks only when the session drifted away from it.
   */
  async describe(
    userId: number,
    organizationId: number | null,
    role: string | null,
  ): Promise<{ memberships: LoginMembership[]; selectionRequired: boolean }> {
    const memberships = await this.listMemberships(userId);
    if (this.flatten(memberships).length <= 1) {
      return { memberships, selectionRequired: false };
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const rememberedMatches =
      user?.lastOrganizationId === organizationId
      && user?.lastRole === role
      && this.findPair(memberships, organizationId, role) !== null;
    return { memberships, selectionRequired: !rememberedMatches };
  }

  /**
   * Stores the confirmed pair on the session and on the user for the next login.
   * Rejects a role the user does not hold in that organization.
   */
  async select(
    plaintextSession: string,
    userId: number,
    organizationId: number,
    role: string,
  ): Promise<void> {
    const memberships = await this.listMemberships(userId);
    const match = this.findPair(memberships, organizationId, role);
    if (!match) {
      throw new BadRequestException('Organization or role is not available');
    }
    await this.sessionIssuanceService.setLoginContext(
      plaintextSession,
      match.organizationId,
      match.role,
    );
    await this.remember(userId, match.organizationId, match.role);
  }

  private async remember(userId: number, organizationId: number, role: string): Promise<void> {
    await this.userRepository.update(
      { id: userId },
      { lastOrganizationId: organizationId, lastRole: role },
    );
  }

  private findPair(
    memberships: LoginMembership[],
    organizationId: number | null,
    role: string | null,
  ): LoginPair | null {
    if (organizationId === null || role === null || role.trim() === '') {
      return null;
    }
    const membership = memberships.find((item) => item.organizationId === organizationId);
    if (!membership || !membership.roles.includes(role)) {
      return null;
    }
    return { organizationId, role };
  }

  private flatten(memberships: LoginMembership[]): LoginPair[] {
    return memberships.flatMap((membership) =>
      membership.roles.map((role) => ({
        organizationId: membership.organizationId,
        role,
      })),
    );
  }

  private roleRank(role: string): number {
    const index = ROLE_PRIORITY_ORDER.indexOf(role as (typeof ROLE_PRIORITY_ORDER)[number]);
    if (index < 0) {
      return ROLE_PRIORITY_ORDER.length;
    }
    return index;
  }
}
