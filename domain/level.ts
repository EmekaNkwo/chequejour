/**
 * Practice level estimate on a 0–1 scale from A2 (0) to B1 (1). This is a practice
 * estimate only: it is not, and does not predict, an official TCF result.
 *
 *   estimate = max(placement baseline,
 *                  0.45 × path progress + 0.25 × vocabulary mastery + 0.30 × demonstrated level)
 *
 * - path progress: completed units / all units
 * - vocabulary mastery: mastered cards / MASTERY_TARGET
 * - demonstrated level: recent answers, where a correct answer earns its item's level
 *   weight (A2 0.2, A2+ 0.6, B1 1.0) and a wrong one earns 0
 */
import type { Level } from './content-types';

export const MASTERY_TARGET = 600;
export const RECENT_ATTEMPTS = 120;
/** At least this many answers before demonstrated level counts fully. */
export const MIN_ATTEMPTS = 30;

export const LEVEL_WEIGHT: Readonly<Record<Level, number>> = { A2: 0.2, 'A2+': 0.6, B1: 1 };

const PLACEMENT_BASELINE: Readonly<Record<Level, number>> = { A2: 0, 'A2+': 0.35, B1: 0.7 };

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
  if (value >= 0.75) return 'B1';
  if (value >= 0.35) return 'A2+';
  return 'A2';
}

export function estimateLevel(input: LevelInput): LevelEstimate {
  const progress = input.totalUnits > 0 ? clamp01(input.completedUnits / input.totalUnits) : 0;
  const mastery = clamp01(input.masteredCards / MASTERY_TARGET);
  const recent = input.recentAttempts.slice(0, RECENT_ATTEMPTS);
  const earned = recent.reduce((sum, a) => sum + (a.correct ? LEVEL_WEIGHT[a.level] : 0), 0);
  const confidence = Math.min(1, recent.length / MIN_ATTEMPTS);
  const demonstrated = recent.length > 0 ? clamp01((earned / recent.length) * confidence) : 0;
  const composite = 0.45 * progress + 0.25 * mastery + 0.3 * demonstrated;
  const baseline = input.placement ? PLACEMENT_BASELINE[input.placement] : 0;
  const value = Math.max(baseline, composite);
  return { value, label: labelFor(value), parts: { progress, mastery, demonstrated } };
}

export function placementLevel(correctByBand: Readonly<Record<Level, { correct: number; total: number }>>): Level {
  const rate = (l: Level): number => {
    const b = correctByBand[l];
    return b.total > 0 ? b.correct / b.total : 0;
  };
  if (rate('A2') >= 0.75 && rate('A2+') >= 0.7 && rate('B1') >= 0.6) return 'B1';
  if (rate('A2') >= 0.75 && rate('A2+') >= 0.5) return 'A2+';
  return 'A2';
}

export function mockTestUnlocked(estimate: number, allA2UnitsDone: boolean): boolean {
  return allA2UnitsDone || estimate >= MOCK_TEST_THRESHOLD;
}
