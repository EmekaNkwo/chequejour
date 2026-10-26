/**
 * What the home-screen widget shows: today's word of the day, read from the local
 * database only. Runs in the widget's background task, so it must cope with a
 * database the app hasn't set up yet.
 */
import { ContentRepository } from '../../data/content-repo';
import { ProgressRepository } from '../../data/progress-repo';
import { loadSettings } from '../../data/settings-repo';
import type { SqlDb } from '../../data/sql';
import { headword } from '../../domain/audio-keys';
import type { VocabItem } from '../../domain/content-types';
import type { DayKey } from '../../domain/dates';
import { dailyContent, ensureDailyItems } from '../daily/daily-service';
import { learnerFor } from '../daily/daily-learner';

export interface WidgetWordView {
  /** Headword with its article, e.g. "le réveil". */
  fr: string;
  /** Gender for nouns, otherwise the part of speech. */
  detail: string;
  en: string;
  /** Deep link that opens this word in the app. */
  url: string;
}

const GENDER_LABEL = { m: 'masculine', f: 'feminine', mf: 'masculine or feminine' } as const;

export function genderLabel(word: Pick<VocabItem, 'pos' | 'gender'>): string {
  return word.pos === 'noun' && word.gender ? GENDER_LABEL[word.gender] : word.pos;
}

export function widgetWordView(word: VocabItem, day: DayKey): WidgetWordView {
  return { fr: headword(word), detail: genderLabel(word), en: word.en, url: `chequejour://daily/word?day=${day}` };
}

/** Today's word, assigning it first if the app hasn't run today. Null if there is none yet. */
export async function loadWidgetWord(db: SqlDb, today: DayKey): Promise<WidgetWordView | null> {
  const ready = await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'content_items'", []);
  if (!ready?.n) return null;
  const content = new ContentRepository(db);
  const progress = new ProgressRepository(db);
  let daily = await dailyContent(content, progress, today);
  if (!daily) {
    const settings = await loadSettings(db);
    await ensureDailyItems(content, progress, today, await learnerFor(content, progress, settings.placementLevel));
    daily = await dailyContent(content, progress, today);
  }
  return daily?.word ? widgetWordView(daily.word, today) : null;
}
