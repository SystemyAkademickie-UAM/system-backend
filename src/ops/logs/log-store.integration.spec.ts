import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { gunzipSync } from 'zlib';

import {
  PRODUCTION_LOG_ARCHIVE_DIR_NAME,
  PRODUCTION_LOG_DIR_ENV,
  PRODUCTION_LOG_TTL_SLOTS_ENV,
} from '../../constants/production-log-constants';
import { formatLogCalendarDate, formatPreviousLogCalendarDate } from './log-calendar';
import { resolveArchiveLogFilePath, resolveLiveLogFilePath } from './log-directory';
import { LogStoreService } from './log-store.service';

describe('LogStoreService (filesystem integration)', () => {
  let previousDir: string | undefined;
  let previousTtl: string | undefined;
  let tempRoot: string;
  const store = new LogStoreService();

  beforeEach(() => {
    previousDir = process.env[PRODUCTION_LOG_DIR_ENV];
    previousTtl = process.env[PRODUCTION_LOG_TTL_SLOTS_ENV];
    tempRoot = mkdtempSync(join(tmpdir(), 'maq-logs-'));
    process.env[PRODUCTION_LOG_DIR_ENV] = tempRoot;
    process.env[PRODUCTION_LOG_TTL_SLOTS_ENV] = '3';
  });

  afterEach(() => {
    if (previousDir === undefined) {
      delete process.env[PRODUCTION_LOG_DIR_ENV];
    } else {
      process.env[PRODUCTION_LOG_DIR_ENV] = previousDir;
    }
    if (previousTtl === undefined) {
      delete process.env[PRODUCTION_LOG_TTL_SLOTS_ENV];
    } else {
      process.env[PRODUCTION_LOG_TTL_SLOTS_ENV] = previousTtl;
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

  it('deletes files older than the TTL', () => {
    const oldDate = '2020-01-01T00-00';
    const livePath = resolveLiveLogFilePath(tempRoot, oldDate);
    mkdirSync(join(tempRoot, 'live'), { recursive: true });
    writeFileSync(livePath, 'ancient\n', 'utf8');
    const removed = store.purgeExpired(new Date('2026-09-05T12:00:00Z'));
    expect(removed).toContain(oldDate);
    expect(existsSync(livePath)).toBe(false);
  });
});
