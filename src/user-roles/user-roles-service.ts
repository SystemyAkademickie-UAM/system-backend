import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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
}
