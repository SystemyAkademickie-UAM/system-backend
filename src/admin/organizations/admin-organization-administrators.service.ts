import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { AdminAccessService } from '../admin-access.service';
import { AccountRemovalService } from '../accounts/account-removal.service';
import { ADMINISTRATOR_ROLE_NAME } from '../../constants/role-name-constants';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { GrantOrganizationAdministratorDto } from './dto/grant-organization-administrator.dto';

export type OrganizationAdministratorListItem = {
  accountId: number;
  userId: number;
  email: string;
  nickname: string;
  name: string;
  surname: string;
};

/** Administrator row plus the organization it belongs to. */
export type OrganizationAdministratorDirectoryItem = OrganizationAdministratorListItem & {
  organizationId: number;
  organizationName: string;
};

type AdministratorRow = {
  accountId?: string | number;
  accountid?: string | number;
  userId?: string | number;
  userid?: string | number;
  organizationId?: string | number;
  organizationid?: string | number;
  organizationName?: string;
  organizationname?: string;
  email: string;
  nickname: string;
  name: string;
  surname: string;
};

@Injectable()
export class AdminOrganizationAdministratorsService {
  private readonly logger = new Logger(AdminOrganizationAdministratorsService.name);

  constructor(
    private readonly adminAccessService: AdminAccessService,
    private readonly accountRemovalService: AccountRemovalService,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>) {}

  async listAdministrators(
    req: Request,
    organizationId: number,
    queryAuth?: string): Promise<OrganizationAdministratorListItem[]> {
    await this.adminAccessService.assertSuperAdmin(req, queryAuth);
    await this.assertOrganizationExists(organizationId);
    const rows = await this.loadAdministrators(organizationId);
    return rows.map((row) => ({
      accountId: row.accountId,
      userId: row.userId,
      email: row.email,
      nickname: row.nickname,
      name: row.name,
      surname: row.surname,
    }));
  }

  /**
   * Administrators of every active organization.
   */
  async listAllAdministrators(
    req: Request,
    queryAuth?: string,
  ): Promise<OrganizationAdministratorDirectoryItem[]> {
    await this.adminAccessService.assertSuperAdmin(req, queryAuth);
    return this.loadAdministrators(null);
  }

  async grantAdministrator(
    req: Request,
    organizationId: number,
    dto: GrantOrganizationAdministratorDto): Promise<OrganizationAdministratorListItem> {
    await this.adminAccessService.assertSuperAdmin(req, dto.auth);
    await this.assertOrganizationExists(organizationId);
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: normalizedEmail })
      .getOne();
    if (user === null) {
      throw new NotFoundException(
        `No user with email ${dto.email.trim()} — they must complete SAML login once before becoming an administrator.`);
    }
    const existing = await this.accountRepository.findOne({
      where: { userId: user.id, organizationId, role: ADMINISTRATOR_ROLE_NAME },
    });
    if (existing) {
      return {
        accountId: existing.id,
        userId: user.id,
        email: user.email,
        nickname: user.nickname,
        name: user.name,
        surname: user.surname,
      };
    }
    const row = this.accountRepository.create({
      userId: user.id,
      organizationId,
      role: ADMINISTRATOR_ROLE_NAME,
    });
    const saved = await this.accountRepository.save(row);
    this.logger.log(
      `Granted administrator org=${organizationId} userId=${user.id} accountId=${saved.id}`);
    return {
      accountId: saved.id,
      userId: user.id,
      email: user.email,
      nickname: user.nickname,
      name: user.name,
      surname: user.surname,
    };
  }

  async revokeAdministrator(
    req: Request,
    organizationId: number,
    accountId: number,
    queryAuth?: string): Promise<void> {
    await this.adminAccessService.assertSuperAdmin(req, queryAuth);
    await this.assertOrganizationExists(organizationId);
    const row = await this.accountRepository.findOne({
      where: { id: accountId, organizationId, role: ADMINISTRATOR_ROLE_NAME },
    });
    if (row === null) {
      throw new NotFoundException(
        `Administrator account ${accountId} not found for organization ${organizationId}`);
    }
    const result = await this.accountRemovalService.removeOrganizationAccountRecord(
      organizationId,
      accountId);
    this.logger.log(
      `Revoked administrator org=${organizationId} accountId=${accountId} userRemoved=${result.userRemoved}`);
  }

  private async loadAdministrators(
    organizationId: number | null,
  ): Promise<OrganizationAdministratorDirectoryItem[]> {
    const query = this.accountRepository
      .createQueryBuilder('account')
      .innerJoin(UserEntity, 'user', 'user.id = account.user_id')
      .innerJoin(OrganizationEntity, 'organization', 'organization.id = account.organization_id')
      .select('account.id', 'accountId')
      .addSelect('account.user_id', 'userId')
      .addSelect('account.organization_id', 'organizationId')
      .addSelect('organization.name', 'organizationName')
      .addSelect('user.email', 'email')
      .addSelect('user.nickname', 'nickname')
      .addSelect('user.name', 'name')
      .addSelect('user.surname', 'surname')
      .where('account.role = :role', { role: ADMINISTRATOR_ROLE_NAME })
      .andWhere('organization.is_active = true')
      .orderBy('account.organization_id', 'ASC')
      .addOrderBy('account.id', 'ASC');
    if (organizationId !== null) {
      query.andWhere('account.organization_id = :organizationId', { organizationId });
    }
    const rows = await query.getRawMany<AdministratorRow>();
    const items: OrganizationAdministratorDirectoryItem[] = [];
    for (const row of rows) {
      const item = this.mapAdministratorRow(row);
      if (item !== null) {
        items.push(item);
      }
    }
    return items;
  }

  private mapAdministratorRow(row: AdministratorRow): OrganizationAdministratorDirectoryItem | null {
    const accountId = this.readPositiveInteger(row.accountId ?? row.accountid);
    const userId = this.readPositiveInteger(row.userId ?? row.userid);
    const organizationId = this.readPositiveInteger(row.organizationId ?? row.organizationid);
    if (accountId === null || userId === null || organizationId === null) {
      return null;
    }
    return {
      accountId,
      userId,
      organizationId,
      organizationName: row.organizationName ?? row.organizationname ?? '',
      email: row.email,
      nickname: row.nickname,
      name: row.name,
      surname: row.surname,
    };
  }

  private readPositiveInteger(value: string | number | undefined): number | null {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  private async assertOrganizationExists(organizationId: number): Promise<void> {
    const organization = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (organization === null) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }
    if (!organization.isActive) {
      throw new BadRequestException(`Organization ${organizationId} is inactive`);
    }
  }
}
