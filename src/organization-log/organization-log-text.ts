import { ORGANIZATION_LOG_TEXT_MAX_LENGTH } from '../constants/organization-log-constants';

const DETAIL_STRING_KEYS = ['itemName', 'activityName', 'badgeName', 'rankName', 'postTitle', 'stageName'] as const;
const DETAIL_NUMBER_KEYS = ['price', 'points', 'delta', 'count', 'lives'] as const;
const DETAIL_BOOLEAN_KEYS = ['shopOpen', 'livesEnabled', 'livesShopEnabled', 'isExtraLife'] as const;

/**
 * Trims names, file names, and stored detail before they are written or shown.
 */
export class OrganizationLogText {
  static clip(value: string): string {
    return value.trim().slice(0, ORGANIZATION_LOG_TEXT_MAX_LENGTH);
  }

  static personName(name: string, surname: string): string {
    return OrganizationLogText.clip(`${name} ${surname}`.trim());
  }

  static fileBaseName(value: string): string {
    const trimmed = value.replace(/[\u0000-\u001f]/g, '').trim();
    const parts = trimmed.split(/[/\\]/);
    return parts[parts.length - 1] ?? '';
  }

  static wholeBytes(value: number | null | undefined): number | null {
    if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
      return null;
    }
    return Math.floor(value);
  }

  static sanitizeDetail(
    value: Record<string, unknown> | null | undefined,
  ): Record<string, string | number | boolean | null> {
    if (value === null || value === undefined) {
      return {};
    }
    return {
      ...OrganizationLogText.stringDetails(value),
      ...OrganizationLogText.numberDetails(value),
      ...OrganizationLogText.booleanDetails(value),
    };
  }

  static parseInboxDetail(value: unknown): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      return {};
    }
    return OrganizationLogText.parseJsonObject(value);
  }

  private static stringDetails(value: Record<string, unknown>): Record<string, string> {
    const detail: Record<string, string> = {};
    for (const key of DETAIL_STRING_KEYS) {
      const raw = value[key];
      if (typeof raw === 'string' && raw.trim().length > 0) {
        detail[key] = OrganizationLogText.clip(raw);
      }
    }
    return detail;
  }

  private static numberDetails(value: Record<string, unknown>): Record<string, number> {
    const detail: Record<string, number> = {};
    for (const key of DETAIL_NUMBER_KEYS) {
      const raw = value[key];
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        detail[key] = raw;
      }
    }
    return detail;
  }

  private static booleanDetails(value: Record<string, unknown>): Record<string, boolean> {
    const detail: Record<string, boolean> = {};
    for (const key of DETAIL_BOOLEAN_KEYS) {
      const raw = value[key];
      if (typeof raw === 'boolean') {
        detail[key] = raw;
      }
    }
    return detail;
  }

  private static parseJsonObject(value: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
}
