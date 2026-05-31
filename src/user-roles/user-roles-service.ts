import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  ADMINISTRATOR_ROLE_NAME,
  LECTURER_ROLE_NAME,
  STUDENT_ROLE_NAME,
  SUPER_ROLE_NAME,
} from '../constants/role-name-constants';
import { AccountEntity } from '../database/entities/account.entity';

/**
 * Queries `auth.accounts` for RBAC checks (independent of how the user authenticated).
 */
@Injectable()
export class UserRolesService {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
  ) {}

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
   * Picks the highest-privilege role when a user has multiple `auth.accounts` rows.
   */
  async resolvePrimaryRoleForUser(userId: number): Promise<string | null> {
    const rows = await this.accountRepository.find({
      where: { userId },
      select: ['role'],
    });
    if (rows.length === 0) {
      return null;
    }
    const roleNames = new Set(rows.map((row) => row.role));
    if (roleNames.has(SUPER_ROLE_NAME)) {
      return SUPER_ROLE_NAME;
    }
    if (roleNames.has(ADMINISTRATOR_ROLE_NAME)) {
      return ADMINISTRATOR_ROLE_NAME;
    }
    if (roleNames.has(LECTURER_ROLE_NAME)) {
      return LECTURER_ROLE_NAME;
    }
    if (roleNames.has(STUDENT_ROLE_NAME)) {
      return STUDENT_ROLE_NAME;
    }
    return rows[0]?.role ?? null;
  }
}
