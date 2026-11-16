import type { EntityManager } from 'typeorm';

export type OrganizationLogWrite = {
  organizationId: number;
  category: 'organization' | 'group';
  kind: string;
  actorUserId?: number | null;
  actorName?: string;
  subjectAccountId?: number | null;
  subjectName?: string;
  groupId?: number | null;
  groupName?: string;
  roleName?: string | null;
  fileKind?: 'image' | 'file' | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  detail?: Record<string, unknown> | null;
};

export type OrganizationLogGroupWrite = {
  groupId: number;
  kind: string;
  actorAccountId: number | null;
  detail?: Record<string, unknown> | null;
  manager?: EntityManager;
};

export type OrganizationLogLinkSet = {
  group: string | null;
  account: string | null;
  profile: string | null;
};

export type OrganizationLogListItem = {
  id: string;
  source: 'archive' | 'inbox';
  occurredAt: string;
  category: 'organization' | 'group';
  kind: string;
  actorName: string;
  subjectName: string;
  subjectAccountId: number | null;
  groupName: string;
  roleName: string | null;
  fileKind: 'image' | 'file' | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  detail: Record<string, string | number | boolean | null>;
  links: OrganizationLogLinkSet;
  internalGroupId?: number | null;
};

export type OrganizationLogListResponse = {
  items: OrganizationLogListItem[];
  nextBefore: string | null;
  nextBeforeId: number | null;
  nextBeforeSource: 'archive' | 'inbox' | null;
};

/** One page request after the query DTO has been checked. */
export type OrganizationLogListQuery = {
  category: string;
  limit: number;
  before: Date | null;
  beforeId: number | null;
  beforeSource: 'archive' | 'inbox' | null;
};

/** One row read from analytics.organization_log. */
export type OrganizationLogArchiveRow = {
  id: number;
  occurredAt: Date;
  category: string;
  kind: string;
  actorName: string;
  subjectName: string;
  subjectAccountId: number | null;
  groupId: number | null;
  groupName: string;
  roleName: string | null;
  fileKind: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  detail: Record<string, unknown> | null;
};

/** One collapsed inbox row copied into the administrator page. */
export type OrganizationLogInboxRow = {
  id: number;
  occurredAt: Date;
  kind: string;
  accountId: number | null;
  groupId: number;
  groupName: string;
  detail: Record<string, unknown>;
};
