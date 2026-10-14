import { PRODUCTION_LOG_TIMEZONE } from '../../constants/production-log-constants';

type ZonedDateTimeParts = {
  year: string;
  month: string;
  day: string;
};

function readZonedParts(instant: Date): ZonedDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PRODUCTION_LOG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  return { year, month, day };
}

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Calendar day `YYYY-MM-DD` in {@link PRODUCTION_LOG_TIMEZONE}.
 */
export function formatLogCalendarDate(instant: Date): string {
  const parts = readZonedParts(instant);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Adds (or subtracts) civil days on a `YYYY-MM-DD` string.
 */
export function addLogCalendarDays(calendarDate: string, deltaDays: number): string {
  const [year, month, day] = calendarDate.split('-').map((part) => Number.parseInt(part, 10));
  const shifted = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return `${shifted.getUTCFullYear()}-${padTwoDigits(shifted.getUTCMonth() + 1)}-${padTwoDigits(shifted.getUTCDate())}`;
}

/**
 * Month folder key `YYYY-MM` for a calendar day.
 */
export function formatLogMonthKey(calendarDate: string): string {
  return calendarDate.slice(0, 7);
}

/**
 * Oldest calendar day still retained when keeping `ttlDays` days including today.
 */
export function formatLogRetentionCutoffDate(today: string, ttlDays: number): string {
  return addLogCalendarDays(today, -(ttlDays - 1));
}

/**
 * ISO-like timestamp in {@link PRODUCTION_LOG_TIMEZONE} for a log line prefix.
 */
export function formatLogLineTimestamp(instant: Date): string {
  return instant.toLocaleString('sv-SE', {
    timeZone: PRODUCTION_LOG_TIMEZONE,
    hour12: false,
  });
}

/**
 * Previous calendar day in Warsaw (closed daily file).
 */
export function formatPreviousLogCalendarDate(instant: Date): string {
  return addLogCalendarDays(formatLogCalendarDate(instant), -1);
}
