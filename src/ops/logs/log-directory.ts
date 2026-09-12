import { join } from 'path';

import {
  PRODUCTION_LOG_ARCHIVE_DIR_NAME,
  PRODUCTION_LOG_DIR_ENV,
  PRODUCTION_LOG_FILE_EXTENSION,
  PRODUCTION_LOG_GZIP_EXTENSION,
  PRODUCTION_LOG_LIVE_DIR_NAME,
  PRODUCTION_LOG_TTL_SLOTS_DEFAULT,
  PRODUCTION_LOG_TTL_SLOTS_ENV,
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

/**
 * How many 5-minute slots to keep before automatic delete.
 */
export function resolveProductionLogTtlSlots(): number {
  const raw = process.env[PRODUCTION_LOG_TTL_SLOTS_ENV];
  if (raw === undefined || raw.trim().length === 0) {
    return PRODUCTION_LOG_TTL_SLOTS_DEFAULT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return PRODUCTION_LOG_TTL_SLOTS_DEFAULT;
  }
  return parsed;
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
