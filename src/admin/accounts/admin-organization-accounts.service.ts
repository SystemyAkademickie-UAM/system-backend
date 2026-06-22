import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { In, Repository } from 'typeorm';

import { AdminAccessService } from '../admin-access.service';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import {
  ADMINISTRATOR_ROLE_NAME,
  SUPER_ROLE_NAME,
} from '../../constants/role-name-constants';
import { SessionService } from '../../auth/session/session.service';
import { UserRolesService } from '../../user-roles/user-roles-service';

export type OrganizationAccountListItem = {
  accountId: number;
  userId: number;
  email: string;
  nickname: string;
  role: string;
};

export type ManageableOrganizationItem = {
  id: number;
  name: string;
};

@Injectable()
export class AdminOrganizationAccountsService {
  constructor(
    private readonly adminAccessService: AdminAccessService,
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>) {}

  async listManageableOrganizations(req: Request): Promise<ManageableOrganizationItem[]> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, undefined);
    if (subject === null) {
      throw new ForbiddenException('Not authorized');
    }
    const isSuperAdmin = await this.userRolesService.userHasRole(subject.userId, SUPER_ROLE_NAME);
    if (isSuperAdmin) {
      const organizations = await this.organizationRepository.find({
        where: { isActive: true },
        order: { id: 'ASC' },
      });
      return organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
      }));
    }
    const adminAccounts = await this.accountRepository.find({
      where: { userId: subject.userId, role: ADMINISTRATOR_ROLE_NAME },
      order: { organizationId: 'ASC' },
    });
    if (adminAccounts.length === 0) {
      return [];
    }
    const organizationIds = [...new Set(adminAccounts.map((row) => row.organizationId))];
    const organizations = await this.organizationRepository.find({
      where: { id: In(organizationIds), isActive: true },
      order: { id: 'ASC' },
    });
    return organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
    }));
  }

  async listOrganizationAccounts(
    req: Request,
    organizationId: number): Promise<OrganizationAccountListItem[]> {
    await this.adminAccessService.resolveAccountDeletionActor(req, organizationId);
    await this.assertOrganizationActive(organizationId);
    const rows = await this.accountRepository.find({
      where: { organizationId },
      order: { id: 'ASC' },
    });
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const users = userIds.length === 0
      ? []
      : await this.userRepository.find({ where: { id: In(userIds) } });
    const usersById = new Map(users.map((user) => [user.id, user]));
    const items: OrganizationAccountListItem[] = [];
    for (const row of rows) {
      const user = usersById.get(row.userId);
      if (user === undefined) {
        continue;
      }
      items.push({
        accountId: row.id,
        userId: user.id,
        email: user.email,
        nickname: user.nickname,
        role: row.role,
      });
    }
    items.sort((left, right) => {
      const emailCompare = left.email.localeCompare(right.email);
      if (emailCompare !== 0) {
        return emailCompare;
      }
      return left.role.localeCompare(right.role);
    });
    return items;
  }

  private async assertOrganizationActive(organizationId: number): Promise<void> {
    const organization = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (organization === null) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }
    if (!organization.isActive) {
      throw new BadRequestException(`Organization ${organizationId} is inactive`);
    }
  }
}
