/**
 * Calendar helpers built on local "day keys" (YYYY-MM-DD in the device's time zone),
 * so streaks and daily items follow the learner's own calendar.
 */

export type DayKey = string;

const MS_PER_DAY = 86_400_000;

const pad = (n: number): string => String(n).padStart(2, '0');

export function toDayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses a day key into a local Date at midnight. */
export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Days since 1970-01-01 for a day key; independent of time zone and DST. */
export function dayNumber(key: DayKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = fromDayKey(key);
  return toDayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return dayNumber(to) - dayNumber(from);
}

/** The 7 day keys ending at `end` (oldest first). */
export function lastNDays(end: DayKey, n: number): DayKey[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - (n - 1)));
}

/** Monday of the week containing `key`. */
export function startOfWeek(key: DayKey): DayKey {
  const weekday = (fromDayKey(key).getDay() + 6) % 7;
  return addDays(key, -weekday);
}

export interface TimeOfDay {
  hour: number;
  minute: number;
}

export function formatTime({ hour, minute }: TimeOfDay): string {
  return `${pad(hour)}:${pad(minute)}`;
}

export function atTime(key: DayKey, time: TimeOfDay): Date {
  const date = fromDayKey(key);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.hour, time.minute, 0, 0);
}

/** A Date at `time` on the same day as `base`, for native time pickers. `base` is not modified. */
export function timeToDate(time: TimeOfDay, base: Date = new Date()): Date {
  const d = new Date(base);
  d.setHours(time.hour, time.minute, 0, 0);
  return d;
}

export function dateToTime(date: Date): TimeOfDay {
  return { hour: date.getHours(), minute: date.getMinutes() };
}
