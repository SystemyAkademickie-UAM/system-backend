import {
  PRODUCTION_LOG_SLOT_MINUTES,
  PRODUCTION_LOG_SLOT_MS,
  PRODUCTION_LOG_TIMEZONE,
} from '../../constants/production-log-constants';

type ZonedDateTimeParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
};

function readZonedParts(instant: Date): ZonedDateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PRODUCTION_LOG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return { year, month, day, hour, minute };
}

function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Simulation slot id `YYYY-MM-DDTHH-mm` (5-minute buckets, Europe/Warsaw).
 */
export function formatLogCalendarDate(instant: Date): string {
  const parts = readZonedParts(instant);
  const minuteNumber = Number.parseInt(parts.minute, 10);
  const slottedMinute = Math.floor(minuteNumber / PRODUCTION_LOG_SLOT_MINUTES) * PRODUCTION_LOG_SLOT_MINUTES;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}-${padTwoDigits(slottedMinute)}`;
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
 * Previous 5-minute slot (for gzip of the closed window).
 */
export function formatPreviousLogCalendarDate(instant: Date): string {
  const shifted = new Date(instant.getTime() - PRODUCTION_LOG_SLOT_MS);
  return formatLogCalendarDate(shifted);
}
