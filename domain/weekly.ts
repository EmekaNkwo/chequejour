/**
 * Weekly summary and per-skill statistics.
 */
import { GRAMMAR_TAG_LABELS, SKILLS, type GrammarTag, type Skill } from './content-types';

export interface AttemptRecord {
  skill: Skill;
  grammarTag: GrammarTag | null;
  correct: boolean;
  answeredAt: number;
}

export interface StudyDay {
  day: string;
  seconds: number;
  reviews: number;
}

export interface WeakPoint {
  tag: GrammarTag;
  label: string;
  accuracy: number;
  attempts: number;
}

export interface WeeklySummary {
  wordsLearned: number;
  accuracy: number | null;
  minutes: number;
  reviews: number;
  daysStudied: number;
  weakest: WeakPoint[];
}

/** Grammar points need this many answers before they can be called "weak". */
export const MIN_ATTEMPTS_FOR_WEAKNESS = 3;

export function weakestGrammar(attempts: readonly AttemptRecord[], limit = 3): WeakPoint[] {
  const byTag = new Map<GrammarTag, { right: number; total: number }>();
  for (const a of attempts) {
    if (a.grammarTag === null || a.grammarTag === 'vocabulary') continue;
    const entry = byTag.get(a.grammarTag) ?? { right: 0, total: 0 };
    byTag.set(a.grammarTag, { right: entry.right + (a.correct ? 1 : 0), total: entry.total + 1 });
  }
  return [...byTag.entries()]
    .filter(([, v]) => v.total >= MIN_ATTEMPTS_FOR_WEAKNESS)
    .map(([tag, v]) => ({ tag, label: GRAMMAR_TAG_LABELS[tag], accuracy: v.right / v.total, attempts: v.total }))
    .filter((w) => w.accuracy < 1)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
    .slice(0, limit);
}

export function weeklySummary(
  attempts: readonly AttemptRecord[],
  days: readonly StudyDay[],
  wordsLearned: number,
): WeeklySummary {
  const correct = attempts.filter((a) => a.correct).length;
  const seconds = days.reduce((n, d) => n + d.seconds, 0);
  return {
    wordsLearned,
    accuracy: attempts.length > 0 ? correct / attempts.length : null,
    minutes: Math.round(seconds / 60),
    reviews: days.reduce((n, d) => n + d.reviews, 0),
    daysStudied: days.filter((d) => d.seconds > 0 || d.reviews > 0).length,
    weakest: weakestGrammar(attempts),
  };
}

export interface SkillStat {
  skill: Skill;
  attempts: number;
  accuracy: number | null;
  /** 0–1 share of the skill's course items completed. */
  completion: number;
}

export function skillStats(
  attempts: readonly AttemptRecord[],
  completion: Readonly<Record<Skill, number>>,
): SkillStat[] {
  return SKILLS.map((skill) => {
    const of = attempts.filter((a) => a.skill === skill);
    const right = of.filter((a) => a.correct).length;
    return {
      skill,
      attempts: of.length,
      accuracy: of.length > 0 ? right / of.length : null,
      completion: completion[skill],
    };
  });
}

/** Mistakes come back after 1, 3, then 7 days; three correct retries in a row clear them. */
export const MISTAKE_INTERVALS_DAYS: readonly number[] = [1, 3, 7];
export const MISTAKE_CLEAR_STREAK = 3;

export interface MistakeSchedule {
  nextReviewAt: number;
  correctStreak: number;
  resolved: boolean;
}

export function rescheduleMistake(
  current: { correctStreak: number },
  correct: boolean,
  now: number,
): MistakeSchedule {
  const streak = correct ? current.correctStreak + 1 : 0;
  const interval = MISTAKE_INTERVALS_DAYS[Math.min(streak, MISTAKE_INTERVALS_DAYS.length - 1)];
  return {
    correctStreak: streak,
    resolved: streak >= MISTAKE_CLEAR_STREAK,
    nextReviewAt: now + interval * 86_400_000,
  };
}
