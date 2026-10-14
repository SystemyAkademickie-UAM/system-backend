import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { gunzipSync, gzipSync } from 'zlib';

import {
  PRODUCTION_LOG_ARCHIVE_DIR_NAME,
  PRODUCTION_LOG_DIR_ENV,
  PRODUCTION_LOG_TTL_DAYS_ENV,
  PRODUCTION_LOG_TTL_SLOTS_ENV,
} from '../../constants/production-log-constants';
import { formatLogCalendarDate, formatPreviousLogCalendarDate } from './log-calendar';
import { resolveArchiveLogFilePath, resolveLiveLogFilePath, resolveMonthlyArchiveZipPath } from './log-directory';
import { LogStoreService } from './log-store.service';
import { LogZipStore } from './log-zip-store';

describe('LogStoreService (filesystem integration)', () => {
  let previousDir: string | undefined;
  let previousTtlDays: string | undefined;
  let previousTtlSlots: string | undefined;
  let tempRoot: string;
  const store = new LogStoreService();

  beforeEach(() => {
    previousDir = process.env[PRODUCTION_LOG_DIR_ENV];
    previousTtlDays = process.env[PRODUCTION_LOG_TTL_DAYS_ENV];
    previousTtlSlots = process.env[PRODUCTION_LOG_TTL_SLOTS_ENV];
    tempRoot = mkdtempSync(join(tmpdir(), 'maq-logs-'));
    process.env[PRODUCTION_LOG_DIR_ENV] = tempRoot;
    process.env[PRODUCTION_LOG_TTL_DAYS_ENV] = '3';
    delete process.env[PRODUCTION_LOG_TTL_SLOTS_ENV];
  });

  afterEach(() => {
    if (previousDir === undefined) {
      delete process.env[PRODUCTION_LOG_DIR_ENV];
    } else {
      process.env[PRODUCTION_LOG_DIR_ENV] = previousDir;
    }
    if (previousTtlDays === undefined) {
      delete process.env[PRODUCTION_LOG_TTL_DAYS_ENV];
    } else {
      process.env[PRODUCTION_LOG_TTL_DAYS_ENV] = previousTtlDays;
    }
    if (previousTtlSlots === undefined) {
      delete process.env[PRODUCTION_LOG_TTL_SLOTS_ENV];
    } else {
      process.env[PRODUCTION_LOG_TTL_SLOTS_ENV] = previousTtlSlots;
    }
  });

  it('writes a readable daily file and lists that date', () => {
    store.appendLine('error', 'TestContext', 'disk full');
    const today = formatLogCalendarDate(new Date());
    const livePath = resolveLiveLogFilePath(tempRoot, today);
    const content = readFileSync(livePath, 'utf8');
    expect(content).toContain('[error]');
    expect(content).toContain('[TestContext]');
    expect(content).toContain('disk full');
    expect(store.listAvailableDates()).toEqual([today]);
  });

  it('gzips a closed day into a dated archive that gunzips to the original text', () => {
    const yesterday = formatPreviousLogCalendarDate(new Date());
    const livePath = resolveLiveLogFilePath(tempRoot, yesterday);
    mkdirSync(join(tempRoot, 'live'), { recursive: true });
    writeFileSync(livePath, 'line-from-yesterday\n', 'utf8');
    const archived = store.archiveClosedDays();
    expect(archived).toEqual([yesterday]);
    expect(existsSync(livePath)).toBe(false);
    const archivePath = resolveArchiveLogFilePath(tempRoot, yesterday);
    expect(archivePath).toContain(PRODUCTION_LOG_ARCHIVE_DIR_NAME);
    expect(archivePath.endsWith(`${yesterday}.log.gz`)).toBe(true);
    const restored = gunzipSync(readFileSync(archivePath)).toString('utf8');
    expect(restored).toBe('line-from-yesterday\n');
    expect(store.readDayPlaintext(yesterday).toString('utf8')).toBe('line-from-yesterday\n');
  });

  it('zips gzipped days of a closed month and reads a day from the zip', () => {
    const archiveDir = join(tempRoot, PRODUCTION_LOG_ARCHIVE_DIR_NAME);
    mkdirSync(archiveDir, { recursive: true });
    const gzipPath = resolveArchiveLogFilePath(tempRoot, '2026-01-15');
    writeFileSync(gzipPath, gzipSync(Buffer.from('january-line\n')));
    const packed = store.packClosedMonths(new Date('2026-02-10T12:00:00Z'));
    expect(packed).toEqual(['2026-01']);
    expect(existsSync(gzipPath)).toBe(false);
    const zipPath = resolveMonthlyArchiveZipPath(tempRoot, '2026-01');
    expect(LogZipStore.listNames(readFileSync(zipPath))).toEqual(['2026-01-15.log.gz']);
    expect(store.readDayPlaintext('2026-01-15').toString('utf8')).toBe('january-line\n');
    expect(store.listAvailableDates()).toEqual(['2026-01-15']);
  });

  it('deletes files older than the TTL in days', () => {
    const oldDate = '2020-01-01';
    const livePath = resolveLiveLogFilePath(tempRoot, oldDate);
    mkdirSync(join(tempRoot, 'live'), { recursive: true });
    writeFileSync(livePath, 'ancient\n', 'utf8');
    const removed = store.purgeExpired(new Date('2026-09-05T12:00:00Z'));
    expect(removed).toContain(oldDate);
    expect(existsSync(livePath)).toBe(false);
  });
});
