import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { GROUP_RESPONSE_GROUP_ID_OFFSET } from '../constants/group-api-constants';
import { AccountEntity } from '../database/entities/account.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { UserEntity } from '../database/entities/user.entity';
import { OrganizationLogText } from './organization-log-text';
import type { OrganizationLogListItem } from './organization-log.types';

type AccountFacts = {
  live: Set<number>;
  names: Map<number, string>;
};

/**
 * Adds a link only while the person or group still belongs to the organization.
 */
@Injectable()
export class OrganizationLogLinksReader {
  constructor(
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(EnrollmentEntity)
    private readonly enrollmentRepository: Repository<EnrollmentEntity>,
  ) {}

  /**
   * Returns the page items with live links and without the internal group id.
   */
  async attach(organizationId: number, items: OrganizationLogListItem[]): Promise<OrganizationLogListItem[]> {
    const groupIds = this.uniqueIds(items, (item) => item.internalGroupId);
    const accountIds = this.uniqueIds(items, (item) => item.subjectAccountId);
    const liveGroups = await this.loadLiveGroups(organizationId, groupIds);
    const accounts = await this.loadAccounts(organizationId, accountIds);
    const enrolled = await this.loadEnrolled(groupIds, accountIds);
    return items.map((item) => this.linkedItem(item, liveGroups, accounts, enrolled));
  }

  private uniqueIds(
    items: OrganizationLogListItem[],
    read: (item: OrganizationLogListItem) => number | null | undefined,
  ): number[] {
    return [...new Set(items.flatMap((item) => {
      const id = read(item);
      return id == null ? [] : [id];
    }))];
  }

  private async loadLiveGroups(organizationId: number, groupIds: number[]): Promise<Map<number, string>> {
    if (groupIds.length === 0) {
      return new Map();
    }
    const groups = await this.groupRepository.find({
      where: { id: In(groupIds) },
      select: ['id', 'name', 'teacherAccountId'],
    });
    const teacherIds = [...new Set(groups.map((group) => group.teacherAccountId))];
    const teachers = await this.loadTeachers(teacherIds);
    return new Map(
      groups
        .filter((group) => teachers.get(group.teacherAccountId) === organizationId)
        .map((group) => [group.id, group.name]),
    );
  }

  private async loadTeachers(teacherIds: number[]): Promise<Map<number, number>> {
    if (teacherIds.length === 0) {
      return new Map();
    }
    const teachers = await this.accountRepository.find({
      where: { id: In(teacherIds) },
      select: ['id', 'organizationId'],
    });
    return new Map(teachers.map((teacher) => [teacher.id, teacher.organizationId]));
  }

  private async loadAccounts(organizationId: number, accountIds: number[]): Promise<AccountFacts> {
    if (accountIds.length === 0) {
      return { live: new Set(), names: new Map() };
    }
    const accounts = await this.accountRepository.find({
      where: { id: In(accountIds), organizationId },
      select: ['id', 'userId'],
    });
    const names = await this.loadAccountNames(accounts);
    return { live: new Set(accounts.map((account) => account.id)), names };
  }

  private async loadAccountNames(accounts: Array<Pick<AccountEntity, 'id' | 'userId'>>): Promise<Map<number, string>> {
    if (accounts.length === 0) {
      return new Map();
    }
    const users = await this.userRepository.find({
      where: { id: In(accounts.map((account) => account.userId)) },
      select: ['id', 'name', 'surname'],
    });
    const userNames = new Map(users.map((user) => [user.id, OrganizationLogText.personName(user.name, user.surname)]));
    return new Map(accounts.map((account) => [account.id, userNames.get(account.userId) ?? '']));
  }

  private async loadEnrolled(groupIds: number[], accountIds: number[]): Promise<Set<string>> {
    if (groupIds.length === 0 || accountIds.length === 0) {
      return new Set();
    }
    const enrollments = await this.enrollmentRepository.find({
      where: accountIds.flatMap((accountId) => groupIds.map((groupId) => ({
        studentAccountId: accountId,
        groupId,
      }))),
      select: ['studentAccountId', 'groupId'],
    });
    return new Set(enrollments.map((row) => `${row.groupId}:${row.studentAccountId}`));
  }

  private linkedItem(
    item: OrganizationLogListItem,
    liveGroups: Map<number, string>,
    accounts: AccountFacts,
    enrolled: Set<string>,
  ): OrganizationLogListItem {
    const groupId = item.internalGroupId ?? null;
    const groupLive = groupId !== null && liveGroups.has(groupId);
    const accountLive = item.subjectAccountId !== null && accounts.live.has(item.subjectAccountId);
    const publicGroupId = groupLive && groupId !== null ? groupId + GROUP_RESPONSE_GROUP_ID_OFFSET : null;
    const { internalGroupId: _internalGroupId, ...visible } = item;
    return {
      ...visible,
      subjectName: this.subjectName(item, accounts.names),
      groupName: groupLive && groupId !== null ? (liveGroups.get(groupId) ?? item.groupName) : item.groupName,
      links: {
        group: publicGroupId === null ? null : `/groups/${publicGroupId}`,
        account: accountLive && item.subjectAccountId !== null ? `/users?accountId=${item.subjectAccountId}` : null,
        profile: this.profileLink(publicGroupId, groupId, item.subjectAccountId, accountLive, enrolled),
      },
    };
  }

  private subjectName(item: OrganizationLogListItem, names: Map<number, string>): string {
    if (item.subjectName.length > 0) {
      return item.subjectName;
    }
    if (item.subjectAccountId === null) {
      return '';
    }
    return names.get(item.subjectAccountId) ?? '';
  }

  private profileLink(
    publicGroupId: number | null,
    groupId: number | null,
    accountId: number | null,
    accountLive: boolean,
    enrolled: Set<string>,
  ): string | null {
    if (publicGroupId === null || !accountLive || accountId === null || groupId === null) {
      return null;
    }
    if (!enrolled.has(`${groupId}:${accountId}`)) {
      return null;
    }
    return `/groups/${publicGroupId}/student-profile/${accountId}`;
  }
}
