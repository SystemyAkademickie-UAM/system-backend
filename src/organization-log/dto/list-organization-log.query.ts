import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min, Validate } from 'class-validator';

import { OrganizationLogCursorCompleteConstraint } from './organization-log-cursor.constraint';

import {
  ORGANIZATION_LOG_CATEGORIES,
  ORGANIZATION_LOG_PAGE_SIZE_MAX,
  ORGANIZATION_LOG_SOURCE_ARCHIVE,
  ORGANIZATION_LOG_SOURCE_INBOX,
} from '../../constants/organization-log-constants';

/** Query for one page of the organization administrator log. */
export class ListOrganizationLogQueryDto {
  /** Always present so the cursor trio is checked even when every query field is omitted. */
  @Validate(OrganizationLogCursorCompleteConstraint)
  cursorParts = true;

  @IsOptional()
  @IsIn(ORGANIZATION_LOG_CATEGORIES)
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ORGANIZATION_LOG_PAGE_SIZE_MAX)
  limit?: number;

  @IsOptional()
  @IsISO8601()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  beforeId?: number;

  @IsOptional()
  @IsIn([ORGANIZATION_LOG_SOURCE_ARCHIVE, ORGANIZATION_LOG_SOURCE_INBOX])
  beforeSource?: 'archive' | 'inbox';
}
