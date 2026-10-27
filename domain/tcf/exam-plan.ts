/**
 * Exam date countdown and how it shapes the daily session.
 *
 * - More than EXAM_FOCUS_DAYS away (or no date): the usual even rotation of skills.
 * - Within EXAM_FOCUS_DAYS: the weakest TCF skill comes up twice as often.
 * - Final FINAL_STRETCH_DAYS: grammar drills leave the rotation (TCF Canada has no
 *   structures test), the weakest skill comes up three times as often, and each
 *   session adds a short mock-style practice.
 */
import type { Skill } from '../content-types';
import { daysBetween, type DayKey } from '../dates';
import type { TcfSkill } from './exam-format';

export const EXAM_FOCUS_DAYS = 60;
export const FINAL_STRETCH_DAYS = 14;

export type ExamPhase = 'none' | 'far' | 'focus' | 'final' | 'past';

/** Days from today to the exam (0 on the day), or null without a date. */
export function daysToExam(examDate: DayKey | null, today: DayKey): number | null {
  return examDate ? daysBetween(today, examDate) : null;
}

export function examPhase(days: number | null): ExamPhase {
  if (days === null) return 'none';
  if (days < 0) return 'past';
  if (days <= FINAL_STRETCH_DAYS) return 'final';
  if (days <= EXAM_FOCUS_DAYS) return 'focus';
  return 'far';
}

/** "63 days to your TCF", "Your TCF is tomorrow", … or null without a date. */
export function countdownLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days < 0) return 'Your TCF date has passed';
  if (days === 0) return 'Your TCF is today. Bonne chance !';
  if (days === 1) return 'Your TCF is tomorrow';
  return `${days} days to your TCF`;
}

const BASE_ROTATION: readonly Skill[] = ['listening', 'reading', 'structures', 'writing', 'speaking'];

/** How often each skill comes up in one rotation cycle. */
export function skillWeights(phase: ExamPhase, weakest: TcfSkill | null): Record<Skill, number> {
  const weights: Record<Skill, number> = { listening: 1, reading: 1, structures: 1, writing: 1, speaking: 1 };
  if (phase === 'focus') {
    if (weakest) weights[weakest] += 1;
  } else if (phase === 'final') {
    weights.structures = 0;
    if (weakest) weights[weakest] += 2;
  }
  return weights;
}

/**
 * A repeatable cycle where a skill with weight 3 comes up three times, spread evenly
 * (also across the end of one cycle and the start of the next); the other skills
 * fill the gaps in their usual order.
 */
export function weightedRotation(weights: Readonly<Record<Skill, number>>): Skill[] {
  const skills = BASE_ROTATION.filter((s) => weights[s] > 0);
  const total = skills.reduce((n, s) => n + weights[s], 0);
  const slots: (Skill | null)[] = Array.from({ length: total }, () => null);
  const repeated = skills.filter((s) => weights[s] > 1).sort((a, b) => weights[b] - weights[a]);
  for (const s of repeated) {
    for (let i = 0; i < weights[s]; i += 1) {
      let pos = Math.floor((i * total) / weights[s]);
      while (slots[pos % total] !== null) pos += 1;
      slots[pos % total] = s;
    }
  }
  const once = skills.filter((s) => weights[s] === 1);
  let next = 0;
  return slots.map((s) => s ?? once[next++]);
}

export function sessionSkill(dayNumber: number, phase: ExamPhase, weakest: TcfSkill | null): Skill {
  const cycle = weightedRotation(skillWeights(phase, weakest));
  return cycle[((dayNumber % cycle.length) + cycle.length) % cycle.length];
}

/** In the final stretch each session adds mock-style practice, on the weakest skill when known. */
export function examPracticeSkill(phase: ExamPhase, weakest: TcfSkill | null, dayNumber: number): TcfSkill | null {
  if (phase !== 'final') return null;
  if (weakest) return weakest;
  const order: readonly TcfSkill[] = ['listening', 'reading', 'writing', 'speaking'];
  return order[((dayNumber % order.length) + order.length) % order.length];
}
