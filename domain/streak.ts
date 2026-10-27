/**
 * Daily streak with a rest-day allowance: one missed day per rolling 7 days is
 * forgiven, so a single day off doesn't reset the streak. Two misses in a row, or
 * two within a week, end it.
 */
import { addDays, daysBetween, type DayKey } from './dates';

export const REST_DAY_WINDOW = 7;

/** Ten years of history is more than enough. */
const MAX_LOOKBACK_DAYS = 3660;

export interface StreakInfo {
  /** Days studied in the current streak (rest days don't add to the count). */
  current: number;
  activeToday: boolean;
  /** Rest days used inside the current streak, newest first. */
  restDays: DayKey[];
  /** True when missing today would still be forgiven. */
  restAvailable: boolean;
}

export function computeStreak(activeDays: ReadonlySet<DayKey>, today: DayKey): StreakInfo {
  const activeToday = activeDays.has(today);
  const restDays: DayKey[] = [];
  let current = activeToday ? 1 : 0;

  // Today isn't over, so an inactive today never breaks the streak: start from yesterday.
  let day = addDays(today, -1);
  for (let i = 0; i < MAX_LOOKBACK_DAYS; i += 1) {
    if (activeDays.has(day)) {
      current += 1;
    } else {
      const previousRest = restDays[restDays.length - 1];
      const twoInARow = !activeDays.has(addDays(day, -1));
      const tooSoon = previousRest !== undefined && daysBetween(day, previousRest) < REST_DAY_WINDOW;
      if (twoInARow || tooSoon) break;
      restDays.push(day);
    }
    day = addDays(day, -1);
  }

  if (current === 0) return { current: 0, activeToday, restDays: [], restAvailable: true };
  const newestRest = restDays[0];
  const restAvailable = newestRest === undefined || daysBetween(newestRest, today) >= REST_DAY_WINDOW;
  return { current, activeToday, restDays, restAvailable };
}
