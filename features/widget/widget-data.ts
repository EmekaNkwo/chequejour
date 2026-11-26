/**
 * What the home-screen widget shows: today's word, sentence and verb of the day, read
 * from the local database only. Runs in the widget's background task, so it must cope
 * with a database the app hasn't set up yet.
 */
import { ContentRepository } from '../../data/content-repo';
import { ProgressRepository } from '../../data/progress-repo';
import { loadSettings } from '../../data/settings-repo';
import type { SqlDb } from '../../data/sql';
import { audioKey, headword } from '../../domain/audio-keys';
import type { Sentence, VocabItem } from '../../domain/content-types';
import type { DayKey } from '../../domain/dates';
import { conjugate, withPronoun, type VerbSpec } from '../../domain/exercises/conjugation-tables';
import { verbOfDay } from '../../domain/verb-of-day';
import { dailyContent, ensureDailyItems } from '../daily/daily-service';
import { learnerFor } from '../daily/daily-learner';

export type WidgetItemKind = 'word' | 'sentence' | 'verb';

export interface WidgetItemView {
  kind: WidgetItemKind;
  /** e.g. "MOT DU JOUR". */
  label: string;
  /** The French: headword with its article, the sentence, or the infinitive. */
  fr: string;
  /** English and short details, one line where possible. */
  sub: string;
  /** Deep link that opens this item in the app. */
  url: string;
  /** Bundled clip for the pronunciation button; text-to-speech reads `fr` without one. */
  audioKey: string;
}

const GENDER_LABEL = { m: 'masculine', f: 'feminine', mf: 'masculine or feminine' } as const;

export function genderLabel(word: Pick<VocabItem, 'pos' | 'gender'>): string {
  return word.pos === 'noun' && word.gender ? GENDER_LABEL[word.gender] : word.pos;
}

export function widgetWordView(word: VocabItem, day: DayKey): WidgetItemView {
  return { kind: 'word', label: 'MOT DU JOUR', fr: headword(word), sub: `${genderLabel(word)} · ${word.en}`, url: `chequejour://daily/word?day=${day}`, audioKey: audioKey.word(word.id) };
}

export function widgetSentenceView(sentence: Sentence, day: DayKey): WidgetItemView {
  return { kind: 'sentence', label: 'PHRASE DU JOUR', fr: sentence.fr, sub: sentence.en, url: `chequejour://daily/sentence?day=${day}`, audioKey: audioKey.sentence(sentence.id) };
}

export function widgetVerbView(verb: VerbSpec, day: DayKey): WidgetItemView {
  const present = conjugate(verb, 'présent');
  const forms = `${withPronoun(present[0], 0, 'présent')}, ${withPronoun(present[3], 3, 'présent')}`;
  return { kind: 'verb', label: 'VERBE DU JOUR', fr: verb.infinitive, sub: `${verb.en} · ${forms}`, url: `chequejour://daily/verb?day=${day}`, audioKey: `verb:${verb.infinitive}` };
}

/** Today's items, assigning them first if the app hasn't run today. Empty if there are none yet. */
export async function loadWidgetDaily(db: SqlDb, today: DayKey): Promise<WidgetItemView[]> {
  const ready = await db.getFirstAsync<{ n: number }>("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'content_items'", []);
  if (!ready?.n) return [];
  const content = new ContentRepository(db);
  const progress = new ProgressRepository(db);
  const settings = await loadSettings(db);
  const learner = await learnerFor(content, progress, settings.placementLevel);
  let daily = await dailyContent(content, progress, today);
  if (!daily) {
    await ensureDailyItems(content, progress, today, learner);
    daily = await dailyContent(content, progress, today);
  }
  if (!daily) return [];
  return [
    ...(daily.word ? [widgetWordView(daily.word, today)] : []),
    ...(daily.sentence ? [widgetSentenceView(daily.sentence, today)] : []),
    widgetVerbView(verbOfDay(today, learner.level), today),
  ];
}
