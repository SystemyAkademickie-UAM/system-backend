import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, type EntityManager, In, MoreThan, Not, Repository } from 'typeorm';

import { MagicLinkService, type RequestMagicLinkResponse } from '../../auth/magic-link/magic-link.service';
import {
  ORGANIZATION_ACCOUNT_DEFAULT_AVATAR_ID,
  ORGANIZATION_ACCOUNT_DEFAULT_LANGUAGE,
  ORGANIZATION_ACCOUNT_EXPORT_COLUMNS,
  ORGANIZATION_ACCOUNT_ORG_ADMIN_ROLES,
  ORGANIZATION_ACCOUNT_PAGE_SIZE_DEFAULT,
  ORGANIZATION_ACCOUNT_PLACEHOLDER_STUDENT_ID,
} from '../../constants/organization-account-management-constants';
import { ORGANIZATION_LOGIN_METHOD_EMAIL } from '../../constants/organization-constants';
import {
  ADMINISTRATOR_ROLE_NAME,
  SUPER_ROLE_NAME,
} from '../../constants/role-name-constants';
import { AUTH_USER_NAME_FIELD_MAX_LENGTH } from '../../constants/database-entity-constants';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AdminAccessService, type AccountDeletionActor } from '../admin-access.service';
import type { OrganizationAccountListItem } from './admin-organization-accounts.service';
import type {
  CreateOrganizationAccountDto,
  ImportOrganizationAccountsDto,
  UpdateOrganizationAccountDto,
} from './dto/organization-account.dto';

export type OrganizationAccountPage = {
  items: OrganizationAccountListItem[];
  nextAfterAccountId: number | null;
};

export type OrganizationAccountImportResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: Array<{ email: string; message: string }>;
};

type ImportOutcome = 'created' | 'updated' | 'skipped';

/**
 * Creates, edits, pages, imports, and exports accounts inside one organization.
 */
@Injectable()
export class AdminOrganizationAccountRosterService {
  constructor(
    private readonly adminAccessService: AdminAccessService,
    private readonly magicLinkService: MagicLinkService,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly dataSource: DataSource) {}

  /** Reads one account that belongs to the organization in the URL. */
  async getOrganizationAccount(
    req: Request,
    organizationId: number,
    accountId: number): Promise<OrganizationAccountListItem> {
    await this.requireActor(req, organizationId);
    await this.requireActiveOrganization(organizationId);
    return this.loadAccountItem(organizationId, accountId);
  }

  /** Returns the next page of accounts with id greater than `afterAccountId`. */
  async listOrganizationAccountPage(
    req: Request,
    organizationId: number,
    afterAccountId: number,
    limit: number): Promise<OrganizationAccountPage> {
    await this.requireActor(req, organizationId);
    await this.requireActiveOrganization(organizationId);
    const pageSize = limit > 0 ? limit : ORGANIZATION_ACCOUNT_PAGE_SIZE_DEFAULT;
    const rows = await this.accountRepository.find({
      where: { organizationId, id: MoreThan(afterAccountId) },
      order: { id: 'ASC' },
      take: pageSize + 1,
    });
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const items = await this.mapAccounts(pageRows);
    const lastRow = pageRows[pageRows.length - 1];
    return {
      items,
      nextAfterAccountId: hasMore && lastRow !== undefined ? lastRow.id : null,
    };
  }

  /** Builds a CSV of every account in the organization. */
  async exportOrganizationAccountsCsv(req: Request, organizationId: number): Promise<string> {
    await this.requireActor(req, organizationId);
    await this.requireActiveOrganization(organizationId);
    const rows = await this.accountRepository.find({
      where: { organizationId },
      order: { id: 'ASC' },
    });
    const items = await this.mapAccounts(rows);
    const lines = [ORGANIZATION_ACCOUNT_EXPORT_COLUMNS.join(',')];
    for (const item of items) {
      lines.push(ORGANIZATION_ACCOUNT_EXPORT_COLUMNS.map((column) => this.escapeCsv(String(item[column]))).join(','));
    }
    return `${lines.join('\n')}\n`;
  }

  /** Creates a person or adds a role inside this organization. */
  async createOrganizationAccount(
    req: Request,
    organizationId: number,
    dto: CreateOrganizationAccountDto): Promise<OrganizationAccountListItem> {
    const actor = await this.requireActor(req, organizationId);
    await this.requireActiveOrganization(organizationId);
    this.assertRoleAllowed(actor, dto.role);
    const email = this.normalizeEmail(dto.email);
    const existingUser = await this.findUserByEmail(email);
    if (existingUser === null) {
      return this.createUserAndAccount(organizationId, email, dto);
    }
    return this.linkExistingUser(organizationId, existingUser, dto, email);
  }

  /** Changes role or profile fields for one account in this organization. */
  async updateOrganizationAccount(
    req: Request,
    organizationId: number,
    accountId: number,
    dto: UpdateOrganizationAccountDto): Promise<OrganizationAccountListItem> {
    const actor = await this.requireActor(req, organizationId);
    await this.requireActiveOrganization(organizationId);
    if (!this.hasProfileChange(dto) && dto.role === undefined) {
      throw new BadRequestException('At least one field is required');
    }
    const account = await this.findAccountInOrganization(organizationId, accountId);
    this.assertTargetMutable(actor, account.role);
    if (dto.role !== undefined) {
      this.assertRoleAllowed(actor, dto.role);
      await this.assertRoleAvailable(account, dto.role);
    }
    await this.dataSource.transaction(async (manager) => {
      if (this.hasProfileChange(dto)) {
        await this.applyProfileChange(account.userId, organizationId, dto, manager);
      }
      if (dto.role !== undefined) {
        account.role = dto.role;
        await manager.getRepository(AccountEntity).save(account);
      }
    });
    return this.loadAccountItem(organizationId, accountId);
  }

  /** Imports many accounts and reports which rows were created, updated, skipped, or failed. */
  async importOrganizationAccounts(
    req: Request,
    organizationId: number,
    dto: ImportOrganizationAccountsDto): Promise<OrganizationAccountImportResult> {
    const result: OrganizationAccountImportResult = { created: 0, updated: 0, skipped: 0, failed: [] };
    for (const user of dto.users) {
      try {
        const outcome = await this.importOne(req, organizationId, user);
        result[outcome] += 1;
      } catch (err: unknown) {
        result.failed.push({ email: user.email, message: this.readErrorMessage(err) });
      }
    }
    return result;
  }

  /** Queues a magic-link email for one account in an email-login organization. */
  async sendOrganizationAccountMagicLink(
    req: Request,
    organizationId: number,
    accountId: number): Promise<RequestMagicLinkResponse> {
    await this.requireActor(req, organizationId);
    const organization = await this.requireActiveOrganization(organizationId);
    if (organization.loginMethod !== ORGANIZATION_LOGIN_METHOD_EMAIL) {
      throw new BadRequestException('Magic links are only available for email-login organizations');
    }
    const item = await this.loadAccountItem(organizationId, accountId);
    return this.magicLinkService.requestMagicLink(item.email, organizationId, req);
  }

  private async importOne(
    req: Request,
    organizationId: number,
    dto: CreateOrganizationAccountDto): Promise<ImportOutcome> {
    const actor = await this.requireActor(req, organizationId);
    await this.requireActiveOrganization(organizationId);
    this.assertRoleAllowed(actor, dto.role);
    const email = this.normalizeEmail(dto.email);
    const existingUser = await this.findUserByEmail(email);
    if (existingUser === null) {
      await this.createUserAndAccount(organizationId, email, dto);
      return 'created';
    }
    const existingAccount = await this.accountRepository.findOne({
      where: { userId: existingUser.id, organizationId, role: dto.role },
    });
    if (existingAccount === null) {
      await this.linkExistingUser(organizationId, existingUser, dto, email);
      return 'created';
    }
    return 'skipped';
  }

  private async createUserAndAccount(
    organizationId: number,
    email: string,
    dto: CreateOrganizationAccountDto): Promise<OrganizationAccountListItem> {
    return this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(UserEntity);
      const accounts = manager.getRepository(AccountEntity);
      const user = await users.save(users.create({
        email,
        studentId: ORGANIZATION_ACCOUNT_PLACEHOLDER_STUDENT_ID,
        name: dto.name.trim(),
        surname: dto.surname.trim(),
        nickname: this.buildNickname(email, dto.nickname),
        avatarId: ORGANIZATION_ACCOUNT_DEFAULT_AVATAR_ID,
        language: ORGANIZATION_ACCOUNT_DEFAULT_LANGUAGE,
      }));
      const account = await accounts.save(accounts.create({
        userId: user.id,
        organizationId,
        role: dto.role,
      }));
      return this.toItem(account, user);
    });
  }

  private async linkExistingUser(
    organizationId: number,
    user: UserEntity,
    dto: CreateOrganizationAccountDto,
    email: string): Promise<OrganizationAccountListItem> {
    const existingAccount = await this.accountRepository.findOne({
      where: { userId: user.id, organizationId, role: dto.role },
    });
    if (existingAccount !== null) {
      throw new ConflictException(`Account for ${email} with role ${dto.role} already exists`);
    }
    const account = await this.accountRepository.save(this.accountRepository.create({
      userId: user.id,
      organizationId,
      role: dto.role,
    }));
    return this.toItem(account, user);
  }

  private async applyProfileChange(
    userId: number,
    organizationId: number,
    dto: UpdateOrganizationAccountDto | CreateOrganizationAccountDto,
    manager: EntityManager): Promise<void> {
    if (await this.userHasAccountOutsideOrganization(userId, organizationId)) {
      throw new ConflictException('This person also belongs to another organization and cannot be edited here');
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user === null) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    const nextEmail = dto.email !== undefined ? this.normalizeEmail(dto.email) : user.email;
    if (nextEmail !== user.email) {
      await this.assertEmailAvailable(nextEmail, userId);
    }
    user.email = nextEmail;
    if (dto.name !== undefined) {
      user.name = dto.name.trim();
    }
    if (dto.surname !== undefined) {
      user.surname = dto.surname.trim();
    }
    if (dto.nickname !== undefined) {
      user.nickname = dto.nickname.trim();
    }
    await manager.getRepository(UserEntity).save(user);
  }

  private async loadAccountItem(
    organizationId: number,
    accountId: number): Promise<OrganizationAccountListItem> {
    const account = await this.findAccountInOrganization(organizationId, accountId);
    const items = await this.mapAccounts([account]);
    const item = items[0];
    if (item === undefined) {
      throw new NotFoundException(`Account ${accountId} not found for organization ${organizationId}`);
    }
    return item;
  }

  private async findAccountInOrganization(organizationId: number, accountId: number): Promise<AccountEntity> {
    const account = await this.accountRepository.findOne({ where: { id: accountId, organizationId } });
    if (account === null) {
      throw new NotFoundException(`Account ${accountId} not found for organization ${organizationId}`);
    }
    return account;
  }

  private async mapAccounts(rows: AccountEntity[]): Promise<OrganizationAccountListItem[]> {
    const userIds = [...new Set(rows.map((row) => row.userId))];
    const users = userIds.length === 0
      ? []
      : await this.userRepository.find({ where: { id: In(userIds) } });
    const usersById = new Map(users.map((user) => [user.id, user]));
    const items: OrganizationAccountListItem[] = [];
    for (const row of rows) {
      const user = usersById.get(row.userId);
      if (user !== undefined) {
        items.push(this.toItem(row, user));
      }
    }
    return items;
  }

  private toItem(account: AccountEntity, user: UserEntity): OrganizationAccountListItem {
    return {
      accountId: account.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      surname: user.surname,
      nickname: user.nickname,
      role: account.role,
    };
  }

  private async requireActor(req: Request, organizationId: number): Promise<AccountDeletionActor> {
    return this.adminAccessService.resolveAccountDeletionActor(req, organizationId);
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

  private assertRoleAllowed(actor: AccountDeletionActor, role: string): void {
    if (role === SUPER_ROLE_NAME) {
      throw new ForbiddenException('Super administrator role cannot be assigned here');
    }
    if (actor.isSuperAdmin) {
      return;
    }
    if (!ORGANIZATION_ACCOUNT_ORG_ADMIN_ROLES.includes(role as typeof ORGANIZATION_ACCOUNT_ORG_ADMIN_ROLES[number])) {
      throw new ForbiddenException('Organization administrators cannot assign this role');
    }
  }

  private assertTargetMutable(actor: AccountDeletionActor, role: string): void {
    if (role === SUPER_ROLE_NAME) {
      throw new ForbiddenException('Super administrator accounts cannot be changed here');
    }
    if (!actor.isSuperAdmin && role === ADMINISTRATOR_ROLE_NAME) {
      throw new ForbiddenException('Organization administrators cannot change privileged accounts');
    }
  }

  private async assertRoleAvailable(account: AccountEntity, role: string): Promise<void> {
    if (account.role === role) {
      return;
    }
    const duplicate = await this.accountRepository.findOne({
      where: { userId: account.userId, organizationId: account.organizationId, role },
    });
    if (duplicate !== null) {
      throw new ConflictException(`This person already has the ${role} role in this organization`);
    }
  }

  private async assertEmailAvailable(email: string, userId: number): Promise<void> {
    const owner = await this.findUserByEmail(email);
    if (owner !== null && owner.id !== userId) {
      throw new ConflictException(`Email ${email} is already in use`);
    }
  }

  private async findUserByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email })
      .getOne();
  }

  private async userHasAccountOutsideOrganization(userId: number, organizationId: number): Promise<boolean> {
    const count = await this.accountRepository.count({
      where: { userId, organizationId: Not(organizationId) },
    });
    return count > 0;
  }

  private hasProfileChange(dto: UpdateOrganizationAccountDto): boolean {
    return dto.email !== undefined || dto.name !== undefined || dto.surname !== undefined || dto.nickname !== undefined;
  }

  private buildNickname(email: string, requested?: string): string {
    const source = requested !== undefined && requested.trim() !== ''
      ? requested.trim()
      : email.split('@')[0] ?? '';
    const nickname = source.slice(0, AUTH_USER_NAME_FIELD_MAX_LENGTH);
    return nickname === '' ? 'user' : nickname;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private escapeCsv(value: string): string {
    const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
    if (!/[",\n\r]/.test(safe)) {
      return safe;
    }
    return `"${safe.replace(/"/g, '""')}"`;
  }

  private readErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    return 'Import failed';
  }
}
