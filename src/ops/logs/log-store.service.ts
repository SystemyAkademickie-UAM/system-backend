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
  PRODUCTION_LOG_SLOT_MS,
} from '../../constants/production-log-constants';
import { formatLogCalendarDate, formatLogLineTimestamp } from './log-calendar';
import {
  resolveArchiveLogFilePath,
  resolveLiveLogFilePath,
  resolveProductionLogDirectory,
  resolveProductionLogTtlSlots,
} from './log-directory';

/**
 * Writes daily plaintext logs, gzips closed days, deletes files past TTL.
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
      const gzipped = gzipSync(readFileSync(livePath));
      writeFileSync(archivePath, gzipped);
      unlinkSync(livePath);
      archived.push(calendarDate);
    }
    return archived;
  }

  purgeExpired(now = new Date()): string[] {
    const rootDir = resolveProductionLogDirectory();
    const ttlSlots = resolveProductionLogTtlSlots();
    const cutoff = formatLogCalendarDate(new Date(now.getTime() - ttlSlots * PRODUCTION_LOG_SLOT_MS));
    const removed: string[] = [];
    this.purgeDirByDate(
      join(rootDir, PRODUCTION_LOG_LIVE_DIR_NAME),
      PRODUCTION_LOG_FILE_EXTENSION,
      cutoff,
      removed,
    );
    this.purgeDirByDate(
      join(rootDir, PRODUCTION_LOG_ARCHIVE_DIR_NAME),
      PRODUCTION_LOG_GZIP_EXTENSION,
      cutoff,
      removed,
    );
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

  private purgeDirByDate(
    dirPath: string,
    extension: string,
    cutoff: string,
    removed: string[],
  ): void {
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
}
