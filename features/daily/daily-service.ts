/**
 * Word and Sentence of the Day: assignment, lookup, and adding them to reviews.
 */
import type { ContentRepository } from '../../data/content-repo';
import type { ProgressRepository } from '../../data/progress-repo';
import type { Level, Sentence, VocabItem } from '../../domain/content-types';
import { planDailyItems, staleDays, type DailyAssignment } from '../../domain/daily-items';
import type { DayKey } from '../../domain/dates';
import { horizonDays, HORIZON_DAYS } from '../../domain/notification-plan';
import { newCard } from '../../domain/srs';

export interface DailyLearner {
  openUnitIds: readonly string[];
  /** Level of the unit the learner is on; daily items come from this level first. */
  level: Level;
}

export interface EnsureDailyOptions {
  /**
   * Re-plan future, unopened days whose items no longer match the learner's level.
   * Only the notification sync passes this, since it reschedules straight after.
   */
  refreshFuture?: boolean;
}

/** Makes sure today and the next two weeks have a word and a sentence assigned. */
export async function ensureDailyItems(
  content: ContentRepository,
  progress: ProgressRepository,
  today: DayKey,
  learner: DailyLearner,
  options: EnsureDailyOptions = {},
): Promise<DailyAssignment[]> {
  const [stored, wordPool, allWords, allSentences, levels] = await Promise.all([
    progress.dailyItems(),
    content.wordIds(learner.openUnitIds, { uniqueHeadwords: true }),
    content.wordIds(undefined, { uniqueHeadwords: true }),
    content.sentenceIds(),
    content.itemLevels(),
  ]);
  if (allWords.length === 0 || allSentences.length === 0) return [];
  const stale = options.refreshFuture ? new Set(staleDays(stored, today, levels, learner.level)) : new Set<DayKey>();
  const existing = new Map([...stored].filter(([day]) => !stale.has(day)));
  const plan = planDailyItems({ days: horizonDays(today, HORIZON_DAYS), existing, wordPool, allWords, allSentences, levels, level: learner.level });
  if (stale.size > 0) await progress.deleteDailyItems([...stale]);
  await progress.saveDailyItems(plan.filter((a) => !existing.has(a.day)));
  return plan;
}

export interface DailyContent {
  day: DayKey;
  word: VocabItem | null;
  sentence: Sentence | null;
  wordOpened: boolean;
  sentenceOpened: boolean;
}

export async function dailyContent(content: ContentRepository, progress: ProgressRepository, day: DayKey): Promise<DailyContent | null> {
  const row = (await progress.dailyItems()).get(day);
  if (!row) return null;
  const [word, sentence] = await Promise.all([content.item('word', row.wordId), content.item('sentence', row.sentenceId)]);
  return { day, word, sentence, wordOpened: row.wordOpened, sentenceOpened: row.sentenceOpened };
}

/** Opening a daily item marks it seen and puts it in the review queue. */
export async function openDailyItem(progress: ProgressRepository, day: DayKey, kind: 'word' | 'sentence', itemId: string, now: number): Promise<void> {
  await progress.markDailyOpened(day, kind);
  await progress.addCards([newCard(itemId, kind, now)], now);
}
