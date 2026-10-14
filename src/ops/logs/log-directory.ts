import { join } from 'path';

import {
  PRODUCTION_LOG_ARCHIVE_DIR_NAME,
  PRODUCTION_LOG_DIR_ENV,
  PRODUCTION_LOG_FILE_EXTENSION,
  PRODUCTION_LOG_GZIP_EXTENSION,
  PRODUCTION_LOG_LIVE_DIR_NAME,
  PRODUCTION_LOG_TTL_DAYS_DEFAULT,
  PRODUCTION_LOG_TTL_DAYS_ENV,
  PRODUCTION_LOG_TTL_SLOTS_ENV,
  PRODUCTION_LOG_ZIP_EXTENSION,
} from '../../constants/production-log-constants';

/**
 * Root directory for live and archived production logs.
 */
export function resolveProductionLogDirectory(): string {
  const fromEnv = process.env[PRODUCTION_LOG_DIR_ENV];
  if (fromEnv !== undefined && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return join(process.cwd(), '..', 'logs');
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

/**
 * How many calendar days of logs to keep (including today).
 * `PRODUCTION_LOG_TTL_DAYS` wins; `PRODUCTION_LOG_TTL_SLOTS` is a deprecated alias.
 */
export function resolveProductionLogTtlDays(): number {
  const daysRaw = process.env[PRODUCTION_LOG_TTL_DAYS_ENV];
  if (daysRaw !== undefined && daysRaw.trim().length > 0) {
    return parsePositiveInt(daysRaw, PRODUCTION_LOG_TTL_DAYS_DEFAULT);
  }
  return parsePositiveInt(process.env[PRODUCTION_LOG_TTL_SLOTS_ENV], PRODUCTION_LOG_TTL_DAYS_DEFAULT);
}

export function resolveLiveLogFilePath(rootDir: string, calendarDate: string): string {
  return join(rootDir, PRODUCTION_LOG_LIVE_DIR_NAME, `${calendarDate}${PRODUCTION_LOG_FILE_EXTENSION}`);
}

export function resolveArchiveLogFilePath(rootDir: string, calendarDate: string): string {
  return join(
    rootDir,
    PRODUCTION_LOG_ARCHIVE_DIR_NAME,
    `${calendarDate}${PRODUCTION_LOG_GZIP_EXTENSION}`,
  );
}

export function resolveMonthlyArchiveZipPath(rootDir: string, monthKey: string): string {
  return join(rootDir, PRODUCTION_LOG_ARCHIVE_DIR_NAME, `${monthKey}${PRODUCTION_LOG_ZIP_EXTENSION}`);
}
