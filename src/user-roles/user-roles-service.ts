import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserRoleEntity } from '../database/entities/user-role.entity';

/**
 * Queries `user_roles` for RBAC checks (independent of how the user authenticated).
 */
@Injectable()
export class UserRolesService {
  constructor(
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepository: Repository<UserRoleEntity>,
  ) {}

  /**
   * @returns whether the user has at least one row with the given `roleName`.
   */
  async userHasRole(userId: number, roleName: string): Promise<boolean> {
    const row = await this.userRoleRepository.findOne({
      where: { userId, role: roleName },
    });
    return row !== null;
  }
}
