/**
 * Per-skill practice estimate: a CEFR label (A2, A2+, B1) and an approximate NCLC
 * level for each of the four TCF Canada tests. Canadian immigration scores each skill
 * separately, so the weakest one matters most.
 *
 * Everything works on one 0–1 "skill score" scale, the same as a mock test's weighted
 * score (see mock-scoring.ts):
 *
 *   skill score = 0.7 × latest mock score + 0.3 × practice score   (mock in the last 90 days)
 *               = practice score                                   (otherwise, once there is enough practice)
 *
 * Practice evidence is graded answers (listening, reading) or self-assessed tasks
 * (writing, speaking), each weighted by its level (A2 0.2, A2+ 0.6, B1 1). That
 * "demonstrated" value is mapped onto the mock scale; this course's practice goes up
 * to B1, so practice alone tops out around NCLC 6.
 *
 * These are PRACTICE ESTIMATES. They are not official TCF results and do not predict
 * one. Learners must check IRCC for current score requirements.
 */
import type { Level } from '../content-types';
import { LEVEL_WEIGHT } from '../level';
import { TCF_SKILLS, type TcfSkill } from './exam-format';

export type Nclc = 3 | 4 | 5 | 6 | 7 | 8;

/** Lowest skill score for each NCLC level, highest first. Configuration, not law. */
export const NCLC_THRESHOLDS: readonly { nclc: Nclc; minScore: number }[] = [
  { nclc: 8, minScore: 0.9 },
  { nclc: 7, minScore: 0.78 },
  { nclc: 6, minScore: 0.6 },
  { nclc: 5, minScore: 0.45 },
  { nclc: 4, minScore: 0.3 },
  { nclc: 3, minScore: 0 },
];

export const NCLC_TARGETS: readonly Nclc[] = [4, 5, 6, 7, 8];
export const DEFAULT_TARGET_NCLC: Nclc = 7;

/** Mock results older than this no longer count. */
export const MOCK_FRESH_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
export const MOCK_WEIGHT = 0.7;
/** Practice needed before an estimate is shown without a mock. */
export const MIN_PRACTICE: Readonly<Record<TcfSkill, number>> = { listening: 20, reading: 20, writing: 3, speaking: 3 };
/** How many recent practice items count. */
export const RECENT_PRACTICE = 60;

const PRACTICE_FLOOR = 0.3;
const PRACTICE_SPAN = 0.42;

export interface PracticeItem {
  /** 1 for a correct answer, 0 for a wrong one, or a 0–1 self-assessment. */
  score: number;
  level: Level;
}

export interface SkillEvidence {
  skill: TcfSkill;
  /** Mock scores for this skill, newest first. */
  mocks: readonly { score: number; takenAt: number }[];
  /** Practice, newest first. */
  practice: readonly PracticeItem[];
}

export type EstimateSource = 'mock+practice' | 'mock' | 'practice';

export interface SkillEstimate {
  skill: TcfSkill;
  score: number;
  nclc: Nclc;
  cefr: Level;
  source: EstimateSource;
  /** Writing and speaking rest on the learner's own checklist ticks. */
  selfAssessed: boolean;
}

export type SkillEstimateResult = SkillEstimate | { skill: TcfSkill; insufficient: true };

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export function nclcForScore(score: number): Nclc {
  return (NCLC_THRESHOLDS.find((t) => score >= t.minScore) ?? NCLC_THRESHOLDS[NCLC_THRESHOLDS.length - 1]).nclc;
}

/** NCLC 4 and below ≈ A2, 5 ≈ A2+, 6 and above ≈ B1 (the top of this course). */
export function cefrForNclc(nclc: Nclc): Level {
  if (nclc >= 6) return 'B1';
  if (nclc === 5) return 'A2+';
  return 'A2';
}

/** Practice's demonstrated level (0–1) mapped onto the mock score scale. */
export function practiceScore(items: readonly PracticeItem[]): number {
  if (items.length === 0) return 0;
  const demonstrated = items.reduce((n, i) => n + clamp01(i.score) * LEVEL_WEIGHT[i.level], 0) / items.length;
  return PRACTICE_FLOOR + PRACTICE_SPAN * demonstrated;
}

export function estimateSkill(evidence: SkillEvidence, now: number): SkillEstimateResult {
  const fresh = evidence.mocks.filter((m) => now - m.takenAt <= MOCK_FRESH_DAYS * DAY_MS)[0];
  const practice = evidence.practice.slice(0, RECENT_PRACTICE);
  const enoughPractice = practice.length >= MIN_PRACTICE[evidence.skill];
  let score: number;
  let source: EstimateSource;
  if (fresh && enoughPractice) {
    score = MOCK_WEIGHT * fresh.score + (1 - MOCK_WEIGHT) * practiceScore(practice);
    source = 'mock+practice';
  } else if (fresh) {
    score = fresh.score;
    source = 'mock';
  } else if (enoughPractice) {
    score = practiceScore(practice);
    source = 'practice';
  } else {
    return { skill: evidence.skill, insufficient: true };
  }
  const value = clamp01(score);
  const nclc = nclcForScore(value);
  return { skill: evidence.skill, score: value, nclc, cefr: cefrForNclc(nclc), source, selfAssessed: evidence.skill === 'writing' || evidence.skill === 'speaking' };
}

export function isEstimate(r: SkillEstimateResult): r is SkillEstimate {
  return !('insufficient' in r);
}

export interface NclcOverview {
  skills: SkillEstimateResult[];
  /** Lowest NCLC (then lowest score) among skills with an estimate; null with fewer than two. */
  weakest: TcfSkill | null;
  target: Nclc;
}

export function nclcOverview(evidence: readonly SkillEvidence[], target: Nclc, now: number): NclcOverview {
  const bySkill = new Map(evidence.map((e) => [e.skill, e]));
  const skills = TCF_SKILLS.map((skill) => estimateSkill(bySkill.get(skill) ?? { skill, mocks: [], practice: [] }, now));
  const estimated = skills.filter(isEstimate).sort((a, b) => a.nclc - b.nclc || a.score - b.score);
  // "Weakest" only means something once there are at least two skills to compare.
  return { skills, weakest: estimated.length > 1 ? (estimated[0]?.skill ?? null) : null, target };
}

/** NCLC levels still to gain to reach the target; 0 when reached. */
export function gapToTarget(estimate: SkillEstimate, target: Nclc): number {
  return Math.max(0, target - estimate.nclc);
}

export const NCLC_DISCLAIMER =
  'Practice estimate only, from this app’s unofficial exercises and mock tests. It is not an official TCF result and does not predict one. Check IRCC (Immigration, Refugees and Citizenship Canada) for current score requirements.';
