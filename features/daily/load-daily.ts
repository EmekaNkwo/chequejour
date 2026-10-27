import type { DayKey } from '../../domain/dates';
import type { AppServices } from '../app/AppContext';
import { dailyLearner, loadPath } from '../path/path-service';
import { masteredIds } from '../session/session-service';
import { dailyContent, ensureDailyItems, type DailyContent } from './daily-service';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** A valid day key from a route param, or today. */
export function dayParam(raw: string | string[] | undefined, today: DayKey): DayKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && DAY_KEY.test(value) && value <= today ? value : today;
}

/** The day's items, assigning them first if the app hasn't done so yet (e.g. opened from a notification). */
export async function loadDaily(app: Pick<AppServices, 'content' | 'progress' | 'settings' | 'today'>, day: DayKey): Promise<DailyContent | null> {
  const existing = await dailyContent(app.content, app.progress, day);
  if (existing) return existing;
  const path = await loadPath(app.content, app.progress, app.settings.placementLevel, await masteredIds(app.progress));
  await ensureDailyItems(app.content, app.progress, app.today, dailyLearner(path));
  return dailyContent(app.content, app.progress, day);
}

/** Earlier days that have items, most recent first. */
export async function previousDays(app: Pick<AppServices, 'progress'>, today: DayKey, limit = 7): Promise<DayKey[]> {
  const rows = await app.progress.dailyItems();
  return [...rows.keys()]
    .filter((d) => d < today)
    .sort()
    .reverse()
    .slice(0, limit);
}
