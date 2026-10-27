/**
 * Practice level estimate on a 0–1 scale from A1 (0) to B1 (1). This is a practice
 * estimate only: it is not, and does not predict, an official TCF result.
 *
 *   estimate = max(placement baseline,
 *                  0.45 × path progress + 0.25 × vocabulary mastery + 0.30 × demonstrated level)
 *
 * - path progress: completed units / all units
 * - vocabulary mastery: mastered cards / MASTERY_TARGET
 * - demonstrated level: recent answers, where a correct answer earns its item's level
 *   weight (A1 0, A1+ 0.1, A2 0.2, A2+ 0.6, B1 1.0) and a wrong one earns 0
 *
 * Five labels: A1, A1+, A2, A2+, B1. A placement result sets a floor; "not taken"
 * (null) is treated as A2, which is where the course started before the A1 units, so
 * learners from earlier versions keep their label.
 */
import type { Level } from './content-types';

export const MASTERY_TARGET = 600;
export const RECENT_ATTEMPTS = 120;
/** At least this many answers before demonstrated level counts fully. */
export const MIN_ATTEMPTS = 30;

export const LEVEL_WEIGHT: Readonly<Record<Level, number>> = { A1: 0, 'A1+': 0.1, A2: 0.2, 'A2+': 0.6, B1: 1 };

/** Lowest estimate for each label, highest first. */
export const LEVEL_THRESHOLDS: readonly { level: Level; min: number }[] = [
  { level: 'B1', min: 0.75 },
  { level: 'A2+', min: 0.35 },
  { level: 'A2', min: 0.15 },
  { level: 'A1+', min: 0.07 },
  { level: 'A1', min: 0 },
];

const PLACEMENT_BASELINE: Readonly<Record<Level, number>> = { A1: 0, 'A1+': 0.07, A2: 0.15, 'A2+': 0.35, B1: 0.7 };

/** Mock tests open from this estimate, or once all A2/A2+ units are complete. */
export const MOCK_TEST_THRESHOLD = 0.6;

export interface LevelInput {
  completedUnits: number;
  totalUnits: number;
  masteredCards: number;
  /** Most recent first. */
  recentAttempts: readonly { correct: boolean; level: Level }[];
  placement: Level | null;
}

export interface LevelEstimate {
  value: number;
  label: Level;
  parts: { progress: number; mastery: number; demonstrated: number };
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export function labelFor(value: number): Level {
  return (LEVEL_THRESHOLDS.find((t) => value >= t.min) ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]).level;
}

export function estimateLevel(input: LevelInput): LevelEstimate {
  const progress = input.totalUnits > 0 ? clamp01(input.completedUnits / input.totalUnits) : 0;
  const mastery = clamp01(input.masteredCards / MASTERY_TARGET);
  const recent = input.recentAttempts.slice(0, RECENT_ATTEMPTS);
  const earned = recent.reduce((sum, a) => sum + (a.correct ? LEVEL_WEIGHT[a.level] : 0), 0);
  const confidence = Math.min(1, recent.length / MIN_ATTEMPTS);
  const demonstrated = recent.length > 0 ? clamp01((earned / recent.length) * confidence) : 0;
  const composite = 0.45 * progress + 0.25 * mastery + 0.3 * demonstrated;
  const baseline = PLACEMENT_BASELINE[input.placement ?? 'A2'];
  const value = Math.max(baseline, composite);
  return { value, label: labelFor(value), parts: { progress, mastery, demonstrated } };
}

export type BandScores = Readonly<Partial<Record<Level, { correct: number; total: number }>>>;

/** Placement asks the bands in this order, easiest first. */
export const PLACEMENT_BANDS: readonly Level[] = ['A1', 'A1+', 'A2', 'A2+', 'B1'];

const rateOf = (scores: BandScores, l: Level, missing: number): number => {
  const b = scores[l];
  return b && b.total > 0 ? b.correct / b.total : missing;
};

function levelFromRates(rate: (l: Level) => number): Level {
  if (rate('A1') < 0.6) return 'A1';
  if (rate('A1+') < 0.6) return 'A1+';
  if (rate('A2') >= 0.75 && rate('A2+') >= 0.7 && rate('B1') >= 0.6) return 'B1';
  if (rate('A2') >= 0.75 && rate('A2+') >= 0.5) return 'A2+';
  return 'A2';
}

/** Placement result from the bands answered so far; a band not asked counts as 0. */
export function placementLevel(scores: BandScores): Level {
  return levelFromRates((l) => rateOf(scores, l, 0));
}

/**
 * True once the bands still to come can't change the result, so the test stops early:
 * a learner who gets most A1 questions wrong is done after the first block.
 */
export function placementDecided(scores: BandScores): boolean {
  return placementLevel(scores) === levelFromRates((l) => rateOf(scores, l, 1));
}

/** Mock tests are full TCF simulations; below A2 they're allowed but not yet recommended. */
export const MOCK_RECOMMENDED_FROM: Level = 'A2+';

export function isBeginner(level: Level): boolean {
  return level === 'A1' || level === 'A1+';
}

export function mockTestUnlocked(estimate: number, allA2UnitsDone: boolean): boolean {
  return allA2UnitsDone || estimate >= MOCK_TEST_THRESHOLD;
}
