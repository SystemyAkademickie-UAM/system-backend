import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ROLE_PRIORITY_ORDER } from '../constants/role-name-constants';
import { AccountEntity } from '../database/entities/account.entity';

/**
 * Queries `auth.accounts` for RBAC checks (independent of how the user authenticated).
 */
@Injectable()
export class UserRolesService {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>) {}

  /**
   * @returns whether the user has at least one account row with the given `roleName`.
   */
  async userHasRole(userId: number, roleName: string): Promise<boolean> {
    const row = await this.accountRepository.findOne({
      where: { userId, role: roleName },
    });
    return row !== null;
  }

  /**
   * @returns `auth.accounts.id` for an account with the given role, or null when none match.
   */
  async findAccountIdForRole(userId: number, roleName: string): Promise<number | null> {
    const row = await this.accountRepository.findOne({
      where: { userId, role: roleName },
      select: ['id'],
    });
    return row?.id ?? null;
  }

  /**
   * @returns whether the user has an account row with the given role in the organization.
   */
  async userHasRoleInOrganization(
    userId: number,
    organizationId: number,
    roleName: string): Promise<boolean> {
    const row = await this.accountRepository.findOne({
      where: { userId, organizationId, role: roleName },
    });
    return row !== null;
  }

  /**
   * Picks the highest-privilege role when a user has multiple `auth.accounts` rows.
   */
  async resolvePrimaryRoleForUser(userId: number): Promise<string | null> {
    const roles = await this.listRolesForUser(userId);
    return roles[0] ?? null;
  }

  /**
   * @returns distinct roles the user holds, ordered from highest to lowest privilege.
   */
  async listRolesForUser(userId: number): Promise<string[]> {
    const rows = await this.accountRepository.find({
      where: { userId },
      select: ['role'],
    });
    if (rows.length === 0) {
      return [];
    }
    const roleNames = new Set(rows.map((row) => row.role));
    const ordered = ROLE_PRIORITY_ORDER.filter((role) => roleNames.has(role));
    const unknown = [...roleNames].filter((role) => !ROLE_PRIORITY_ORDER.includes(role as never));
    return [...ordered, ...unknown];
  }
}
