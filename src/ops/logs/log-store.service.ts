import { gunzipSync, gzipSync } from 'zlib';
import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import {
  PRODUCTION_LOG_ARCHIVE_DIR_NAME,
  PRODUCTION_LOG_DATE_PATTERN,
  PRODUCTION_LOG_FILE_EXTENSION,
  PRODUCTION_LOG_GZIP_EXTENSION,
  PRODUCTION_LOG_LINE_MAX_CHARS,
  PRODUCTION_LOG_LIVE_DIR_NAME,
  PRODUCTION_LOG_MONTH_PATTERN,
  PRODUCTION_LOG_ZIP_EXTENSION,
} from '../../constants/production-log-constants';
import {
  formatLogCalendarDate,
  formatLogLineTimestamp,
  formatLogMonthKey,
  formatLogRetentionCutoffDate,
} from './log-calendar';
import {
  resolveArchiveLogFilePath,
  resolveLiveLogFilePath,
  resolveMonthlyArchiveZipPath,
  resolveProductionLogDirectory,
  resolveProductionLogTtlDays,
} from './log-directory';
import { LogZipStore, type ZipStoreEntry } from './log-zip-store';

/**
 * Writes daily plaintext logs, gzips closed days, zips closed months, deletes past TTL.
 */
@Injectable()
export class LogStoreService {
  appendLine(level: string, context: string, message: string, instant = new Date()): void {
    const rootDir = resolveProductionLogDirectory();
    const calendarDate = formatLogCalendarDate(instant);
    const livePath = resolveLiveLogFilePath(rootDir, calendarDate);
    mkdirSync(dirname(livePath), { recursive: true });
    const sanitized = this.sanitizeLine(message);
    const line = `${formatLogLineTimestamp(instant)} [${level}] [${context}] ${sanitized}\n`;
    writeFileSync(livePath, line, { flag: 'a', encoding: 'utf8' });
  }

  listAvailableDates(): string[] {
    const rootDir = resolveProductionLogDirectory();
    const dates = new Set<string>();
    this.collectLiveDates(rootDir, dates);
    this.collectArchiveDates(rootDir, dates);
    this.collectMonthlyZipDates(rootDir, dates);
    return [...dates].sort();
  }

  readDayPlaintext(calendarDate: string): Buffer {
    const rootDir = resolveProductionLogDirectory();
    const livePath = resolveLiveLogFilePath(rootDir, calendarDate);
    if (existsSync(livePath)) {
      return readFileSync(livePath);
    }
    const archivePath = resolveArchiveLogFilePath(rootDir, calendarDate);
    if (existsSync(archivePath)) {
      return gunzipSync(readFileSync(archivePath));
    }
    const fromZip = this.readDayFromMonthlyZip(rootDir, calendarDate);
    if (fromZip !== null) {
      return fromZip;
    }
    throw new NotFoundException(`No logs for ${calendarDate}`);
  }

  archiveClosedDays(now = new Date()): string[] {
    const rootDir = resolveProductionLogDirectory();
    const today = formatLogCalendarDate(now);
    const liveDir = join(rootDir, PRODUCTION_LOG_LIVE_DIR_NAME);
    if (!existsSync(liveDir)) {
      return [];
    }
    const archived: string[] = [];
    for (const name of readdirSync(liveDir)) {
      const calendarDate = this.parseLiveFileDate(name);
      if (calendarDate === null || calendarDate >= today) {
        continue;
      }
      const livePath = resolveLiveLogFilePath(rootDir, calendarDate);
      const archivePath = resolveArchiveLogFilePath(rootDir, calendarDate);
      mkdirSync(dirname(archivePath), { recursive: true });
      writeFileSync(archivePath, gzipSync(readFileSync(livePath)));
      unlinkSync(livePath);
      archived.push(calendarDate);
    }
    return archived;
  }

  packClosedMonths(now = new Date()): string[] {
    const rootDir = resolveProductionLogDirectory();
    const currentMonth = formatLogMonthKey(formatLogCalendarDate(now));
    const archiveDir = join(rootDir, PRODUCTION_LOG_ARCHIVE_DIR_NAME);
    if (!existsSync(archiveDir)) {
      return [];
    }
    const byMonth = this.groupClosedGzipFilesByMonth(archiveDir, currentMonth);
    const packed: string[] = [];
    for (const [monthKey, gzipNames] of byMonth) {
      this.writeMonthZip(rootDir, monthKey, gzipNames);
      packed.push(monthKey);
    }
    return packed;
  }

  purgeExpired(now = new Date()): string[] {
    const rootDir = resolveProductionLogDirectory();
    const cutoff = formatLogRetentionCutoffDate(
      formatLogCalendarDate(now),
      resolveProductionLogTtlDays(),
    );
    const removed: string[] = [];
    this.purgeDirByDate(join(rootDir, PRODUCTION_LOG_LIVE_DIR_NAME), PRODUCTION_LOG_FILE_EXTENSION, cutoff, removed);
    this.purgeDirByDate(join(rootDir, PRODUCTION_LOG_ARCHIVE_DIR_NAME), PRODUCTION_LOG_GZIP_EXTENSION, cutoff, removed);
    this.purgeExpiredZipEntries(rootDir, cutoff, removed);
    return removed;
  }

  private sanitizeLine(message: string): string {
    const withoutSecrets = message.replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, '$1[redacted]');
    if (withoutSecrets.length <= PRODUCTION_LOG_LINE_MAX_CHARS) {
      return withoutSecrets.replace(/\r?\n/g, ' ');
    }
    return withoutSecrets.slice(0, PRODUCTION_LOG_LINE_MAX_CHARS).replace(/\r?\n/g, ' ');
  }

  private collectLiveDates(rootDir: string, dates: Set<string>): void {
    const liveDir = join(rootDir, PRODUCTION_LOG_LIVE_DIR_NAME);
    if (!existsSync(liveDir)) {
      return;
    }
    for (const name of readdirSync(liveDir)) {
      const calendarDate = this.parseLiveFileDate(name);
      if (calendarDate !== null) {
        dates.add(calendarDate);
      }
    }
  }

  private collectArchiveDates(rootDir: string, dates: Set<string>): void {
    const archiveDir = join(rootDir, PRODUCTION_LOG_ARCHIVE_DIR_NAME);
    if (!existsSync(archiveDir)) {
      return;
    }
    for (const name of readdirSync(archiveDir)) {
      const calendarDate = this.parseArchiveFileDate(name);
      if (calendarDate !== null) {
        dates.add(calendarDate);
      }
    }
  }

  private collectMonthlyZipDates(rootDir: string, dates: Set<string>): void {
    const archiveDir = join(rootDir, PRODUCTION_LOG_ARCHIVE_DIR_NAME);
    if (!existsSync(archiveDir)) {
      return;
    }
    for (const name of readdirSync(archiveDir)) {
      const monthKey = this.parseMonthZipName(name);
      if (monthKey === null) {
        continue;
      }
      const zip = readFileSync(join(archiveDir, name));
      for (const entryName of LogZipStore.listNames(zip)) {
        const calendarDate = this.parseArchiveFileDate(entryName);
        if (calendarDate !== null) {
          dates.add(calendarDate);
        }
      }
    }
  }

  private readDayFromMonthlyZip(rootDir: string, calendarDate: string): Buffer | null {
    const zipPath = resolveMonthlyArchiveZipPath(rootDir, formatLogMonthKey(calendarDate));
    if (!existsSync(zipPath)) {
      return null;
    }
    const gzipped = LogZipStore.readEntry(readFileSync(zipPath), `${calendarDate}${PRODUCTION_LOG_GZIP_EXTENSION}`);
    if (gzipped === null) {
      return null;
    }
    return gunzipSync(gzipped);
  }

  private groupClosedGzipFilesByMonth(archiveDir: string, currentMonth: string): Map<string, string[]> {
    const byMonth = new Map<string, string[]>();
    for (const name of readdirSync(archiveDir)) {
      const calendarDate = this.parseArchiveFileDate(name);
      if (calendarDate === null) {
        continue;
      }
      const monthKey = formatLogMonthKey(calendarDate);
      if (monthKey >= currentMonth) {
        continue;
      }
      const existing = byMonth.get(monthKey) ?? [];
      existing.push(name);
      byMonth.set(monthKey, existing);
    }
    return byMonth;
  }

  private writeMonthZip(rootDir: string, monthKey: string, gzipNames: string[]): void {
    const zipPath = resolveMonthlyArchiveZipPath(rootDir, monthKey);
    const archiveDir = dirname(zipPath);
    const merged = new Map<string, Buffer>();
    if (existsSync(zipPath)) {
      for (const entry of LogZipStore.readAllEntries(readFileSync(zipPath))) {
        merged.set(entry.name, entry.data);
      }
    }
    for (const gzipName of gzipNames) {
      merged.set(gzipName, readFileSync(join(archiveDir, gzipName)));
    }
    const entries: ZipStoreEntry[] = [...merged.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, data]) => ({ name, data }));
    writeFileSync(zipPath, LogZipStore.build(entries));
    for (const gzipName of gzipNames) {
      unlinkSync(join(archiveDir, gzipName));
    }
  }

  private parseLiveFileDate(fileName: string): string | null {
    if (!fileName.endsWith(PRODUCTION_LOG_FILE_EXTENSION) || fileName.endsWith(PRODUCTION_LOG_GZIP_EXTENSION)) {
      return null;
    }
    const calendarDate = fileName.slice(0, -PRODUCTION_LOG_FILE_EXTENSION.length);
    return PRODUCTION_LOG_DATE_PATTERN.test(calendarDate) ? calendarDate : null;
  }

  private parseArchiveFileDate(fileName: string): string | null {
    if (!fileName.endsWith(PRODUCTION_LOG_GZIP_EXTENSION)) {
      return null;
    }
    const calendarDate = fileName.slice(0, -PRODUCTION_LOG_GZIP_EXTENSION.length);
    return PRODUCTION_LOG_DATE_PATTERN.test(calendarDate) ? calendarDate : null;
  }

  private parseMonthZipName(fileName: string): string | null {
    if (!fileName.endsWith(PRODUCTION_LOG_ZIP_EXTENSION)) {
      return null;
    }
    const monthKey = fileName.slice(0, -PRODUCTION_LOG_ZIP_EXTENSION.length);
    return PRODUCTION_LOG_MONTH_PATTERN.test(monthKey) ? monthKey : null;
  }

  private purgeDirByDate(dirPath: string, extension: string, cutoff: string, removed: string[]): void {
    if (!existsSync(dirPath)) {
      return;
    }
    for (const name of readdirSync(dirPath)) {
      if (!name.endsWith(extension)) {
        continue;
      }
      const calendarDate = name.slice(0, -extension.length);
      if (!PRODUCTION_LOG_DATE_PATTERN.test(calendarDate) || calendarDate >= cutoff) {
        continue;
      }
      unlinkSync(join(dirPath, name));
      removed.push(calendarDate);
    }
  }

  private purgeExpiredZipEntries(rootDir: string, cutoff: string, removed: string[]): void {
    const archiveDir = join(rootDir, PRODUCTION_LOG_ARCHIVE_DIR_NAME);
    if (!existsSync(archiveDir)) {
      return;
    }
    for (const name of readdirSync(archiveDir)) {
      const monthKey = this.parseMonthZipName(name);
      if (monthKey === null) {
        continue;
      }
      const zipPath = join(archiveDir, name);
      const kept = LogZipStore.readAllEntries(readFileSync(zipPath)).filter((entry) => {
        const calendarDate = this.parseArchiveFileDate(entry.name);
        if (calendarDate === null || calendarDate >= cutoff) {
          return true;
        }
        removed.push(calendarDate);
        return false;
      });
      if (kept.length === 0) {
        unlinkSync(zipPath);
        continue;
      }
      writeFileSync(zipPath, LogZipStore.build(kept));
    }
  }
}
