import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  ORGANIZATION_LOG_CATEGORY_GROUP,
  ORGANIZATION_LOG_CATEGORY_ORGANIZATION,
  ORGANIZATION_LOG_SOURCE_ARCHIVE,
} from '../constants/organization-log-constants';
import { OrganizationLogEntity } from '../database/entities/organization-log.entity';
import { OrganizationLogRows } from './organization-log-rows';
import type { OrganizationLogArchiveRow, OrganizationLogListQuery } from './organization-log.types';

/**
 * Reads one page of stored organization log rows.
 */
@Injectable()
export class OrganizationLogArchiveReader {
  constructor(
    @InjectRepository(OrganizationLogEntity)
    private readonly organizationLogRepository: Repository<OrganizationLogEntity>,
  ) {}

  /**
   * Returns archive rows for the organization, optionally limited to one category.
   */
  async load(
    organizationId: number,
    category: string,
    limit: number,
    query: OrganizationLogListQuery,
  ): Promise<OrganizationLogArchiveRow[]> {
    const params: unknown[] = [organizationId];
    let sql = this.selectSql();
    const storedCategory = this.storedCategory(category);
    if (storedCategory !== null) {
      params.push(storedCategory);
      sql += ` AND category = $${params.length}`;
    }
    sql += OrganizationLogRows.cursorSql('occurred_at', 'id', ORGANIZATION_LOG_SOURCE_ARCHIVE, query, params);
    params.push(limit);
    sql += ` ORDER BY occurred_at DESC, id DESC LIMIT $${params.length}`;
    return this.organizationLogRepository.query(sql, params) as Promise<OrganizationLogArchiveRow[]>;
  }

  private selectSql(): string {
    return `
      SELECT id, occurred_at AS "occurredAt", category, kind, actor_name AS "actorName",
        subject_name AS "subjectName", subject_account_id AS "subjectAccountId",
        group_id AS "groupId", group_name AS "groupName", role_name AS "roleName",
        file_kind AS "fileKind", file_name AS "fileName", file_size_bytes AS "fileSizeBytes",
        detail
      FROM analytics.organization_log
      WHERE organization_id = $1
    `;
  }

  private storedCategory(category: string): string | null {
    if (category === ORGANIZATION_LOG_CATEGORY_GROUP || category === ORGANIZATION_LOG_CATEGORY_ORGANIZATION) {
      return category;
    }
    return null;
  }
}
