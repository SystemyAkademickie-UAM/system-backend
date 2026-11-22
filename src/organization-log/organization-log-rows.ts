import {
  ORGANIZATION_LOG_CATEGORY_GROUP,
  ORGANIZATION_LOG_CATEGORY_ORGANIZATION,
  ORGANIZATION_LOG_FILE_KIND_FILE,
  ORGANIZATION_LOG_FILE_KIND_IMAGE,
  ORGANIZATION_LOG_PAGE_SIZE_DEFAULT,
  ORGANIZATION_LOG_PAGE_SIZE_MAX,
  ORGANIZATION_LOG_SOURCE_ARCHIVE,
  ORGANIZATION_LOG_SOURCE_INBOX,
} from '../constants/organization-log-constants';
import { OrganizationLogText } from './organization-log-text';
import type {
  OrganizationLogArchiveRow,
  OrganizationLogInboxRow,
  OrganizationLogListItem,
  OrganizationLogListQuery,
  OrganizationLogListResponse,
} from './organization-log.types';

/**
 * Turns archive and inbox rows into one ordered page.
 */
export class OrganizationLogRows {
  static clampLimit(limit: number): number {
    if (!Number.isInteger(limit) || limit < 1) {
      return ORGANIZATION_LOG_PAGE_SIZE_DEFAULT;
    }
    return Math.min(limit, ORGANIZATION_LOG_PAGE_SIZE_MAX);
  }

  static cursorSql(
    timeColumn: string,
    idColumn: string,
    source: 'archive' | 'inbox',
    query: OrganizationLogListQuery,
    params: unknown[],
  ): string {
    if (query.before === null || query.beforeId === null || query.beforeSource === null) {
      return '';
    }
    params.push(query.before);
    const timeParam = params.length;
    params.push(query.beforeId);
    const idParam = params.length;
    return OrganizationLogRows.cursorClause(timeColumn, idColumn, source, query.beforeSource, timeParam, idParam);
  }

  static merge(
    archive: OrganizationLogArchiveRow[],
    inbox: OrganizationLogInboxRow[],
    limit: number,
  ): OrganizationLogListItem[] {
    const merged = [
      ...archive.map((row) => OrganizationLogRows.fromArchive(row)),
      ...inbox.map((row) => OrganizationLogRows.fromInbox(row)),
    ].sort((left, right) => OrganizationLogRows.compareItems(left, right));
    return merged.slice(0, limit);
  }

  static toResponse(items: OrganizationLogListItem[], hasMore: boolean): OrganizationLogListResponse {
    const last = items[items.length - 1];
    if (!hasMore || last === undefined) {
      return { items, nextBefore: null, nextBeforeId: null, nextBeforeSource: null };
    }
    const rawId = Number(last.id.split(':')[1]);
    return {
      items,
      nextBefore: last.occurredAt,
      nextBeforeId: Number.isInteger(rawId) ? rawId : null,
      nextBeforeSource: last.source,
    };
  }

  private static cursorClause(
    timeColumn: string,
    idColumn: string,
    source: 'archive' | 'inbox',
    beforeSource: 'archive' | 'inbox',
    timeParam: number,
    idParam: number,
  ): string {
    if (source === ORGANIZATION_LOG_SOURCE_ARCHIVE && beforeSource === ORGANIZATION_LOG_SOURCE_INBOX) {
      return ` AND ${timeColumn} < $${timeParam}`;
    }
    if (source === ORGANIZATION_LOG_SOURCE_INBOX && beforeSource === ORGANIZATION_LOG_SOURCE_ARCHIVE) {
      return ` AND (${timeColumn} < $${timeParam} OR ${timeColumn} = $${timeParam})`;
    }
    return ` AND (${timeColumn} < $${timeParam} OR (${timeColumn} = $${timeParam} AND ${idColumn} < $${idParam}))`;
  }

  private static compareItems(left: OrganizationLogListItem, right: OrganizationLogListItem): number {
    const time = new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
    if (time !== 0) {
      return time;
    }
    if (left.source !== right.source) {
      return left.source === ORGANIZATION_LOG_SOURCE_ARCHIVE ? -1 : 1;
    }
    return Number(right.id.split(':')[1]) - Number(left.id.split(':')[1]);
  }

  private static fromArchive(row: OrganizationLogArchiveRow): OrganizationLogListItem {
    return {
      id: `${ORGANIZATION_LOG_SOURCE_ARCHIVE}:${row.id}`,
      source: ORGANIZATION_LOG_SOURCE_ARCHIVE,
      occurredAt: new Date(row.occurredAt).toISOString(),
      category: row.category === ORGANIZATION_LOG_CATEGORY_GROUP
        ? ORGANIZATION_LOG_CATEGORY_GROUP
        : ORGANIZATION_LOG_CATEGORY_ORGANIZATION,
      kind: row.kind,
      actorName: row.actorName ?? '',
      subjectName: row.subjectName ?? '',
      subjectAccountId: row.subjectAccountId,
      internalGroupId: row.groupId,
      groupName: row.groupName ?? '',
      roleName: row.roleName,
      fileKind: OrganizationLogRows.fileKind(row.fileKind),
      fileName: row.fileName,
      fileSizeBytes: row.fileSizeBytes,
      detail: OrganizationLogText.sanitizeDetail(row.detail),
      links: { group: null, account: null, profile: null },
    };
  }

  private static fromInbox(row: OrganizationLogInboxRow): OrganizationLogListItem {
    return {
      id: `${ORGANIZATION_LOG_SOURCE_INBOX}:${row.id}`,
      source: ORGANIZATION_LOG_SOURCE_INBOX,
      occurredAt: row.occurredAt.toISOString(),
      category: ORGANIZATION_LOG_CATEGORY_GROUP,
      kind: row.kind,
      actorName: '',
      subjectName: '',
      subjectAccountId: row.accountId,
      internalGroupId: row.groupId,
      groupName: row.groupName,
      roleName: null,
      fileKind: null,
      fileName: null,
      fileSizeBytes: null,
      detail: OrganizationLogText.sanitizeDetail(row.detail),
      links: { group: null, account: null, profile: null },
    };
  }

  private static fileKind(value: string | null): 'image' | 'file' | null {
    if (value === ORGANIZATION_LOG_FILE_KIND_IMAGE) {
      return ORGANIZATION_LOG_FILE_KIND_IMAGE;
    }
    if (value === ORGANIZATION_LOG_FILE_KIND_FILE) {
      return ORGANIZATION_LOG_FILE_KIND_FILE;
    }
    return null;
  }
}
