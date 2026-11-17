import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { ORGANIZATION_LOG_CATEGORY_GROUP } from '../constants/organization-log-constants';
import { AccountEntity } from '../database/entities/account.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { OrganizationLogEntity } from '../database/entities/organization-log.entity';
import { UserEntity } from '../database/entities/user.entity';
import { OrganizationLogText } from './organization-log-text';
import type { OrganizationLogGroupWrite, OrganizationLogWrite } from './organization-log.types';

/**
 * Writes the organization administrator archive.
 * Callers in a database transaction pass the same manager so a failed action keeps no row.
 */
@Injectable()
export class OrganizationLogService {
  constructor(
    @InjectRepository(OrganizationLogEntity)
    private readonly organizationLogRepository: Repository<OrganizationLogEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
  ) {}

  /**
   * Stores one organization action. A caller inside a transaction passes that manager.
   */
  async record(input: OrganizationLogWrite, manager?: EntityManager): Promise<void> {
    const actorName = await this.resolveActorName(input, manager);
    const subjectName = await this.resolveSubjectName(input, manager);
    const repo = this.repositoryFor(manager);
    const row = repo.create(this.buildRow(input, actorName, subjectName));
    await repo.save(row);
  }

  /**
   * Writes one group action for the organization that owns the group.
   * Does nothing when the group or its leading account is missing.
   */
  async recordForGroup(input: OrganizationLogGroupWrite): Promise<void> {
    const manager = input.manager;
    const group = await this.repositoryForGroup(manager).findOne({
      where: { id: input.groupId },
      select: ['id', 'name', 'teacherAccountId'],
    });
    if (group === null) {
      return;
    }
    const teacher = await this.repositoryForAccount(manager).findOne({
      where: { id: group.teacherAccountId },
      select: ['id', 'organizationId', 'userId'],
    });
    if (teacher === null) {
      return;
    }
    await this.record({
      organizationId: teacher.organizationId,
      category: ORGANIZATION_LOG_CATEGORY_GROUP,
      kind: input.kind,
      actorUserId: input.actorAccountId === null ? teacher.userId : undefined,
      subjectAccountId: input.actorAccountId,
      groupId: group.id,
      groupName: group.name,
      detail: input.detail,
    }, manager);
  }

  private repositoryFor(manager?: EntityManager): Repository<OrganizationLogEntity> {
    if (manager) {
      return manager.getRepository(OrganizationLogEntity);
    }
    return this.organizationLogRepository;
  }

  private repositoryForGroup(manager?: EntityManager): Repository<GroupEntity> {
    if (manager) {
      return manager.getRepository(GroupEntity);
    }
    return this.groupRepository;
  }

  private repositoryForAccount(manager?: EntityManager): Repository<AccountEntity> {
    if (manager) {
      return manager.getRepository(AccountEntity);
    }
    return this.accountRepository;
  }

  private buildRow(input: OrganizationLogWrite, actorName: string, subjectName: string): Partial<OrganizationLogEntity> {
    return {
      organizationId: input.organizationId,
      category: input.category,
      kind: input.kind,
      occurredAt: new Date(),
      actorUserId: input.actorUserId ?? null,
      actorName,
      subjectAccountId: input.subjectAccountId ?? null,
      subjectName,
      groupId: input.groupId ?? null,
      groupName: OrganizationLogText.clip(input.groupName ?? ''),
      roleName: input.roleName ?? null,
      fileKind: input.fileKind ?? null,
      fileName: input.fileName ? OrganizationLogText.clip(OrganizationLogText.fileBaseName(input.fileName)) : null,
      fileSizeBytes: OrganizationLogText.wholeBytes(input.fileSizeBytes),
      detail: OrganizationLogText.sanitizeDetail(input.detail),
    };
  }

  private async resolveActorName(input: OrganizationLogWrite, manager?: EntityManager): Promise<string> {
    if (input.actorName && input.actorName.trim().length > 0) {
      return OrganizationLogText.clip(input.actorName);
    }
    if (input.actorUserId == null) {
      return '';
    }
    const repo = manager ? manager.getRepository(UserEntity) : this.userRepository;
    const user = await repo.findOne({ where: { id: input.actorUserId }, select: ['name', 'surname'] });
    if (user === null) {
      return '';
    }
    return OrganizationLogText.personName(user.name, user.surname);
  }

  private async resolveSubjectName(input: OrganizationLogWrite, manager?: EntityManager): Promise<string> {
    if (input.subjectName && input.subjectName.trim().length > 0) {
      return OrganizationLogText.clip(input.subjectName);
    }
    if (input.subjectAccountId == null) {
      return '';
    }
    const accounts = manager ? manager.getRepository(AccountEntity) : this.accountRepository;
    const account = await accounts.findOne({ where: { id: input.subjectAccountId }, select: ['userId'] });
    if (account === null) {
      return '';
    }
    return this.userName(account.userId, manager);
  }

  private async userName(userId: number, manager?: EntityManager): Promise<string> {
    const users = manager ? manager.getRepository(UserEntity) : this.userRepository;
    const user = await users.findOne({ where: { id: userId }, select: ['name', 'surname'] });
    if (user === null) {
      return '';
    }
    return OrganizationLogText.personName(user.name, user.surname);
  }
}
