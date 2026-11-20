import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { In, Repository } from 'typeorm';

import { AdminAccessService, type AccountDeletionActor } from '../admin-access.service';
import { AccountRemovalService } from '../accounts/account-removal.service';
import { AdminOrganizationAccountRosterService } from '../accounts/admin-organization-account-roster.service';
import {
  ORGANIZATION_ACCOUNT_LIMIT_REACHED_MESSAGE,
  ORGANIZATION_ACCOUNT_SELF_ROLE_MESSAGE,
} from '../../constants/organization-account-management-constants';
import { ORGANIZATION_LOGIN_METHOD_EMAIL } from '../../constants/organization-constants';
import {
  ORGANIZATION_LOG_CATEGORY_ORGANIZATION,
  ORGANIZATION_LOG_KIND_ROLE_GRANTED,
} from '../../constants/organization-log-constants';
import { ADMINISTRATOR_ROLE_NAME } from '../../constants/role-name-constants';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { OrganizationLogService } from '../../organization-log/organization-log.service';
import {
  CreateFirstOrganizationAdministratorDto,
  GrantOrganizationAdministratorDto,
} from './dto/grant-organization-administrator.dto';

export type OrganizationAdministratorCandidate = {
  userId: number;
  email: string;
  nickname: string;
  name: string;
  surname: string;
};

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
    private readonly userRepository: Repository<UserEntity>,
    private readonly rosterService: AdminOrganizationAccountRosterService,
    @Optional() private readonly organizationLogService?: OrganizationLogService) {}

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

  /**
   * People in the organization who do not already hold the administrator role.
   */
  async listCandidates(
    req: Request,
    organizationId: number,
    queryAuth?: string,
  ): Promise<OrganizationAdministratorCandidate[]> {
    await this.adminAccessService.assertSuperAdmin(req, queryAuth);
    await this.assertOrganizationExists(organizationId);
    const accounts = await this.accountRepository.find({ where: { organizationId } });
    const administratorUserIds = new Set(
      accounts.filter((account) => account.role === ADMINISTRATOR_ROLE_NAME).map((account) => account.userId),
    );
    const userIds = [...new Set(accounts.map((account) => account.userId))]
      .filter((userId) => !administratorUserIds.has(userId));
    if (userIds.length === 0) {
      return [];
    }
    const users = await this.userRepository.find({ where: { id: In(userIds) } });
    return users
      .map((user) => ({
        userId: user.id,
        email: user.email,
        nickname: user.nickname,
        name: user.name,
        surname: user.surname,
      }))
      .sort((left, right) => left.surname.localeCompare(right.surname) || left.name.localeCompare(right.name));
  }

  /**
   * Grants the administrator role to a person who already belongs to the organization.
   */
  async grantAdministrator(
    req: Request,
    organizationId: number,
    dto: GrantOrganizationAdministratorDto): Promise<OrganizationAdministratorListItem> {
    const actor = await this.requireSuperActor(req, dto.auth);
    const organization = await this.requireActiveOrganization(organizationId);
    this.assertNotSelf(actor.userId, dto.userId);
    const user = await this.userRepository.findOne({ where: { id: dto.userId } });
    if (user === null) {
      throw new NotFoundException(`User ${dto.userId} not found`);
    }
    const memberships = await this.accountRepository.find({
      where: { userId: user.id, organizationId },
    });
    if (memberships.length === 0) {
      throw new NotFoundException('That person is not in this organization');
    }
    const existing = memberships.find((account) => account.role === ADMINISTRATOR_ROLE_NAME);
    if (existing !== undefined) {
      return this.toAdministratorItem(existing, user);
    }
    await this.assertAccountCapacity(organization);
    const saved = await this.accountRepository.save(this.accountRepository.create({
      userId: user.id,
      organizationId,
      role: ADMINISTRATOR_ROLE_NAME,
    }));
    await this.organizationLogService?.record({
      organizationId,
      category: ORGANIZATION_LOG_CATEGORY_ORGANIZATION,
      kind: ORGANIZATION_LOG_KIND_ROLE_GRANTED,
      actorUserId: actor.userId,
      subjectAccountId: saved.id,
      subjectName: `${user.name} ${user.surname}`.trim(),
      roleName: ADMINISTRATOR_ROLE_NAME,
    });
    this.logger.log(
      `Granted administrator org=${organizationId} userId=${user.id} accountId=${saved.id}`);
    return this.toAdministratorItem(saved, user);
  }

  /**
   * Creates the first person in an email organization and grants the administrator role.
   * Magic-link login can then find that account.
   */
  async createFirstAdministrator(
    req: Request,
    organizationId: number,
    dto: CreateFirstOrganizationAdministratorDto,
  ): Promise<OrganizationAdministratorListItem> {
    await this.requireSuperActor(req, dto.auth);
    const organization = await this.requireActiveOrganization(organizationId);
    if (organization.loginMethod !== ORGANIZATION_LOGIN_METHOD_EMAIL) {
      throw new BadRequestException(
        'People in a SAML organization appear here after they sign in. Choose one of them.',
      );
    }
    const existingCount = await this.accountRepository.count({ where: { organizationId } });
    if (existingCount > 0) {
      throw new ConflictException('This organization already has people. Choose one from the list.');
    }
    const created = await this.rosterService.createOrganizationAccount(req, organizationId, {
      email: dto.email,
      name: dto.name,
      surname: dto.surname,
      role: ADMINISTRATOR_ROLE_NAME,
    });
    return {
      accountId: created.accountId,
      userId: created.userId,
      email: created.email,
      nickname: created.nickname,
      name: created.name,
      surname: created.surname,
    };
  }

  async revokeAdministrator(
    req: Request,
    organizationId: number,
    accountId: number,
    queryAuth?: string): Promise<void> {
    const actor = await this.requireSuperActor(req, queryAuth);
    await this.assertOrganizationExists(organizationId);
    const row = await this.accountRepository.findOne({
      where: { id: accountId, organizationId, role: ADMINISTRATOR_ROLE_NAME },
    });
    if (row === null) {
      throw new NotFoundException(
        `Administrator account ${accountId} not found for organization ${organizationId}`);
    }
    this.assertNotSelf(actor.userId, row.userId);
    const result = await this.accountRemovalService.removeOrganizationAccountRecord(
      organizationId,
      accountId,
      actor.userId);
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
    await this.requireActiveOrganization(organizationId);
  }

  private async requireActiveOrganization(organizationId: number): Promise<OrganizationEntity> {
    const organization = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (organization === null) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }
    if (!organization.isActive) {
      throw new BadRequestException(`Organization ${organizationId} is inactive`);
    }
    return organization;
  }

  private async requireSuperActor(req: Request, queryAuth?: string): Promise<AccountDeletionActor> {
    const actor = await this.adminAccessService.resolveAccountDeletionActor(req, undefined, queryAuth);
    if (!actor.isSuperAdmin) {
      throw new ForbiddenException('Not authorized');
    }
    return actor;
  }

  private assertNotSelf(actorUserId: number, targetUserId: number): void {
    if (actorUserId === targetUserId) {
      throw new ForbiddenException(ORGANIZATION_ACCOUNT_SELF_ROLE_MESSAGE);
    }
  }

  private async assertAccountCapacity(organization: OrganizationEntity): Promise<void> {
    const count = await this.accountRepository.count({ where: { organizationId: organization.id } });
    if (count >= organization.accountLimit) {
      throw new BadRequestException(ORGANIZATION_ACCOUNT_LIMIT_REACHED_MESSAGE);
    }
  }

  private toAdministratorItem(account: AccountEntity, user: UserEntity): OrganizationAdministratorListItem {
    return {
      accountId: account.id,
      userId: user.id,
      email: user.email,
      nickname: user.nickname,
      name: user.name,
      surname: user.surname,
    };
  }
}
