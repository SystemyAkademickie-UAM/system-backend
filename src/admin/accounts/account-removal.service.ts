import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource, QueryRunner, Repository } from 'typeorm';

import {
  ACCOUNT_DELETION_SUPER_FORBIDDEN_ACCOUNT_ROLE,
} from '../../constants/account-deletion-constants';
import { ADMINISTRATOR_ROLE_NAME } from '../../constants/role-name-constants';
import { AccountEntity } from '../../database/entities/account.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { SessionEntity } from '../../database/entities/session.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { UserRolesService } from '../../user-roles/user-roles-service';
import { AdminAccessService, type AccountDeletionActor } from '../admin-access.service';

export type DeleteOrganizationAccountResult = {
  accountId: number;
  userId: number;
  userRemoved: boolean;
};

/**
 * Removes organization accounts and optionally the backing user when no memberships remain.
 */
@Injectable()
export class AccountRemovalService {
  private readonly logger = new Logger(AccountRemovalService.name);

  constructor(
    private readonly adminAccessService: AdminAccessService,
    private readonly userRolesService: UserRolesService,
    private readonly dataSource: DataSource,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>) {}

  async deleteOrganizationAccount(
    req: Request,
    organizationId: number,
    accountId: number): Promise<DeleteOrganizationAccountResult> {
    const actor = await this.adminAccessService.resolveAccountDeletionActor(req, organizationId);
    await this.assertOrganizationActive(organizationId);
    const targetAccount = await this.accountRepository.findOne({
      where: { id: accountId, organizationId },
    });
    if (targetAccount === null) {
      throw new NotFoundException(
        `Account ${accountId} not found for organization ${organizationId}`);
    }
    await this.assertDeletionAllowed(actor, targetAccount);
    return this.removeOrganizationAccountRecord(organizationId, accountId, actor.userId);
  }

  /**
   * Removes one organization account with dependent-data cleanup (no HTTP auth gate).
   * Used by super-admin administrator revoke and internal callers.
   */
  async removeOrganizationAccountRecord(
    organizationId: number,
    accountId: number,
    actorUserId?: number): Promise<DeleteOrganizationAccountResult> {
    await this.assertOrganizationActive(organizationId);
    const targetAccount = await this.accountRepository.findOne({
      where: { id: accountId, organizationId },
    });
    if (targetAccount === null) {
      throw new NotFoundException(
        `Account ${accountId} not found for organization ${organizationId}`);
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.purgeAccountData(queryRunner, accountId);
      await queryRunner.manager.delete(AccountEntity, { id: accountId });
      const userRemoved = await this.removeUserIfOrphaned(queryRunner, targetAccount.userId);
      await queryRunner.commitTransaction();
      this.logger.log(
        `Removed account id=${accountId} org=${organizationId}` +
          `${actorUserId !== undefined ? ` by userId=${actorUserId}` : ''} userRemoved=${userRemoved}`);
      return {
        accountId,
        userId: targetAccount.userId,
        userRemoved,
      };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
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

  private async assertDeletionAllowed(
    actor: AccountDeletionActor,
    targetAccount: AccountEntity): Promise<void> {
    if (targetAccount.role === ACCOUNT_DELETION_SUPER_FORBIDDEN_ACCOUNT_ROLE) {
      throw new ForbiddenException('Super administrator accounts cannot be deleted');
    }
    const targetUserRoles = await this.userRolesService.listRolesForUser(targetAccount.userId);
    if (targetUserRoles.includes(ACCOUNT_DELETION_SUPER_FORBIDDEN_ACCOUNT_ROLE)) {
      throw new ForbiddenException('Users with a super administrator role cannot be deleted');
    }
    if (actor.isSuperAdmin) {
      return;
    }
    if (targetAccount.role === ADMINISTRATOR_ROLE_NAME) {
      throw new ForbiddenException('Organization administrators cannot delete privileged accounts');
    }
  }

  private async purgeAccountData(queryRunner: QueryRunner, accountId: number): Promise<void> {
    const ownedGroups = await queryRunner.query(
      `SELECT COUNT(*)::text AS count FROM education.groups WHERE teacher_account_id = $1`,
      [accountId],
    );
    const ownedGroupCount = Number.parseInt(String(ownedGroups[0]?.count ?? '0'), 10);
    if (ownedGroupCount > 0) {
      throw new ConflictException(
        `Account ${accountId} owns ${ownedGroupCount} group(s); reassign or remove them first`);
    }
    const enrollments = (await queryRunner.query(
      `SELECT id, group_id FROM gamification.enrollments WHERE student_account_id = $1`,
      [accountId],
    )) as Array<{ id: number; group_id: number }>;
    for (const enrollment of enrollments) {
      await queryRunner.query(`DELETE FROM gamification.earned_badges WHERE enrollment_id = $1`, [
        enrollment.id,
      ]);
      await queryRunner.query(`DELETE FROM gamification.student_stats WHERE enrollment_id = $1`, [
        enrollment.id,
      ]);
      await queryRunner.query(
        `DELETE FROM analytics.activity_backlog WHERE group_id = $1 AND account_id = $2`,
        [enrollment.group_id, accountId],
      );
      await queryRunner.query(`DELETE FROM gamification.enrollments WHERE id = $1`, [enrollment.id]);
    }
    await queryRunner.query(`DELETE FROM analytics.backlog WHERE account_id = $1`, [accountId]);
    await queryRunner.query(`DELETE FROM education.group_templates WHERE creator_account_id = $1`, [
      accountId,
    ]);
  }

  private async removeUserIfOrphaned(queryRunner: QueryRunner, userId: number): Promise<boolean> {
    const remainingAccounts = await queryRunner.manager.count(AccountEntity, { where: { userId } });
    if (remainingAccounts > 0) {
      return false;
    }
    const user = await queryRunner.manager.findOne(UserEntity, { where: { id: userId } });
    if (user === null) {
      return false;
    }
    await queryRunner.manager.delete(SessionEntity, { userId });
    await queryRunner.query(`DELETE FROM auth.magic_link_tokens WHERE LOWER(email) = LOWER($1)`, [
      user.email,
    ]);
    await queryRunner.manager.delete(UserEntity, { id: userId });
    return true;
  }
}
