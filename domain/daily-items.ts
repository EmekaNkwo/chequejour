/**
 * Word and Sentence of the Day assignment. Assignments are persisted, so the item a
 * notification announced days in advance is the same one the app opens.
 *
 * - Sentences go in id order and never repeat until every sentence has been used
 *   (365+ sentences means no repeat within a year).
 * - Words come from the learner's unlocked units first, in path order, then from the
 *   rest of the course, and never repeat until every word has been used.
 * - When the learner's level is known, both come from that level first, then easier
 *   levels (closest first), then harder ones.
 */
import { LEVELS, type Level } from './content-types';
import type { DayKey } from './dates';

export interface DailyAssignment {
  day: DayKey;
  wordId: string;
  sentenceId: string;
}

export interface DailyPlanInput {
  days: readonly DayKey[];
  existing: ReadonlyMap<DayKey, DailyAssignment>;
  /** Word ids in preferred order (unlocked units first). */
  wordPool: readonly string[];
  /** Every word id in course order, used once the pool runs out. */
  allWords: readonly string[];
  /** Sentence ids in id order. */
  allSentences: readonly string[];
  /** Level of each word and sentence id. */
  levels?: ReadonlyMap<string, Level>;
  /** The learner's current level. */
  level?: Level;
}

/** Sort key: 0 at the level, then easier levels, then harder ones. */
function distance(itemLevel: Level | undefined, level: Level): number {
  if (itemLevel === undefined) return LEVELS.length * 2;
  const d = LEVELS.indexOf(itemLevel) - LEVELS.indexOf(level);
  return d <= 0 ? -d : LEVELS.length + d;
}

/** `ids` ordered by closeness to `level`; the original order is kept within a level. */
export function levelOrder(ids: readonly string[], levels: ReadonlyMap<string, Level>, level: Level): string[] {
  return ids
    .map((id, index) => ({ id, index, key: distance(levels.get(id), level) }))
    .sort((a, b) => a.key - b.key || a.index - b.index)
    .map((x) => x.id);
}

export interface DailyRowState extends DailyAssignment {
  wordOpened: boolean;
  sentenceOpened: boolean;
}

/**
 * Future days (after `today`) not opened yet whose word or sentence isn't at `level`,
 * so they can be planned again after the learner moves up. Today stays as announced.
 */
export function staleDays(existing: ReadonlyMap<DayKey, DailyRowState>, today: DayKey, levels: ReadonlyMap<string, Level>, level: Level): DayKey[] {
  return [...existing.values()]
    .filter((r) => r.day > today && !r.wordOpened && !r.sentenceOpened)
    .filter((r) => levels.get(r.wordId) !== level || levels.get(r.sentenceId) !== level)
    .map((r) => r.day)
    .sort();
}

/** Picks the first id not yet used; once all are used, starts a fresh cycle. */
function pickNext(order: readonly string[], used: Set<string>): string {
  const fresh = order.find((id) => !used.has(id));
  if (fresh !== undefined) return fresh;
  used.clear();
  return order[0] ?? '';
}

/** Returns assignments for `days`, reusing existing ones and filling the gaps. */
export function planDailyItems(input: DailyPlanInput): DailyAssignment[] {
  const usedWords = new Set<string>();
  const usedSentences = new Set<string>();
  for (const a of input.existing.values()) {
    usedWords.add(a.wordId);
    usedSentences.add(a.sentenceId);
  }
  const poolSet = new Set(input.wordPool);
  const courseOrder = [...input.wordPool, ...input.allWords.filter((id) => !poolSet.has(id))];
  const { levels, level } = input;
  const wordOrder = levels && level ? levelOrder(courseOrder, levels, level) : courseOrder;
  const sentenceOrder = levels && level ? levelOrder(input.allSentences, levels, level) : input.allSentences;

  return [...input.days].sort().map((day) => {
    const existing = input.existing.get(day);
    if (existing) return existing;
    const wordId = pickNext(wordOrder, usedWords);
    const sentenceId = pickNext(sentenceOrder, usedSentences);
    usedWords.add(wordId);
    usedSentences.add(sentenceId);
    return { day, wordId, sentenceId };
  });
}
