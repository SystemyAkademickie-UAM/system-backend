import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  ORGANIZATION_LOG_CATEGORY_ORGANIZATION,
  ORGANIZATION_LOG_INBOX_KIND_BY_TYPE,
  ORGANIZATION_LOG_SOURCE_INBOX,
} from '../constants/organization-log-constants';
import { OrganizationLogEntity } from '../database/entities/organization-log.entity';
import { OrganizationLogRows } from './organization-log-rows';
import { OrganizationLogText } from './organization-log-text';
import type { OrganizationLogInboxRow, OrganizationLogListQuery } from './organization-log.types';

type InboxQueryRow = {
  id: number;
  occurredAt: Date;
  kind: string;
  accountId: number | null;
  groupId: number;
  groupName: string | null;
  detail: unknown;
};

/**
 * Reads collapsed older inbox rows for groups owned by the organization.
 */
@Injectable()
export class OrganizationLogInboxReader {
  constructor(
    @InjectRepository(OrganizationLogEntity)
    private readonly organizationLogRepository: Repository<OrganizationLogEntity>,
  ) {}

  /**
   * Returns no inbox rows when the page asks only for organization actions.
   */
  async load(
    organizationId: number,
    category: string,
    limit: number,
    query: OrganizationLogListQuery,
  ): Promise<OrganizationLogInboxRow[]> {
    if (category === ORGANIZATION_LOG_CATEGORY_ORGANIZATION) {
      return [];
    }
    const cutoff = await this.readCutoff(organizationId);
    const params: unknown[] = [organizationId];
    let sql = this.selectSql(cutoff, params);
    sql += OrganizationLogRows.cursorSql('"occurredAt"', 'id', ORGANIZATION_LOG_SOURCE_INBOX, query, params);
    params.push(limit);
    sql += ` ORDER BY "occurredAt" DESC, id DESC LIMIT $${params.length}`;
    const rows = await this.organizationLogRepository.query(sql, params) as InboxQueryRow[];
    return rows.flatMap((row) => this.mapRow(row));
  }

  private async readCutoff(organizationId: number): Promise<Date | string | null> {
    const rows = await this.organizationLogRepository.query(
      `SELECT MIN(occurred_at) AS cutoff FROM analytics.organization_log WHERE organization_id = $1`,
      [organizationId],
    ) as Array<{ cutoff: Date | string | null }>;
    return rows[0]?.cutoff ?? null;
  }

  private selectSql(cutoff: Date | string | null, params: unknown[]): string {
    let sql = `
      SELECT id, "occurredAt", kind, "accountId", "groupId", "groupName", detail
      FROM (
        SELECT DISTINCT ON (b.group_id, b.type, date_trunc('second', b.date))
          b.id,
          b.date AS "occurredAt",
          b.type AS kind,
          b.account_id AS "accountId",
          b.group_id AS "groupId",
          g.name AS "groupName",
          b.value AS detail
        FROM analytics.backlog b
        INNER JOIN education.groups g ON g.id = b.group_id
        INNER JOIN auth.accounts teacher ON teacher.id = g.teacher_account_id
        WHERE teacher.organization_id = $1
          AND b.date IS NOT NULL
    `;
    if (cutoff instanceof Date || typeof cutoff === 'string') {
      params.push(cutoff);
      sql += ` AND b.date < $${params.length}`;
    }
    sql += `
        ORDER BY b.group_id, b.type, date_trunc('second', b.date), b.id ASC
      ) collapsed
      WHERE 1 = 1
    `;
    return sql;
  }

  private mapRow(row: InboxQueryRow): OrganizationLogInboxRow[] {
    const mapped = ORGANIZATION_LOG_INBOX_KIND_BY_TYPE[row.kind];
    if (mapped === undefined) {
      return [];
    }
    return [{
      id: Number(row.id),
      occurredAt: new Date(row.occurredAt),
      kind: mapped,
      accountId: row.accountId === null ? null : Number(row.accountId),
      groupId: Number(row.groupId),
      groupName: row.groupName ?? '',
      detail: OrganizationLogText.parseInboxDetail(row.detail),
    }];
  }
}
