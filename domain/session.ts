/**
 * Builds the automatic daily session: due reviews first, then one new lesson segment,
 * then one skill exercise. The skill rotates through the five TCF skill areas by day.
 */
import type { Skill } from './content-types';
import type { Segment } from './unit-path';

export type DailyGoal = 10 | 15 | 20;

export const DAILY_GOALS: readonly DailyGoal[] = [10, 15, 20];

/** Reviews that fit into the goal, leaving room for the lesson and skill task. */
export const REVIEW_BUDGET: Readonly<Record<DailyGoal, number>> = { 10: 15, 15: 25, 20: 40 };

export const MISTAKES_PER_SESSION = 3;

export interface SkillTask {
  skill: Skill;
  itemId: string;
  title: string;
}

export type SessionStep =
  | { kind: 'review'; itemIds: string[] }
  | { kind: 'mistakes'; mistakeIds: number[] }
  | { kind: 'lesson'; segment: Segment }
  | { kind: 'skill'; task: SkillTask };

export interface SessionInput {
  goal: DailyGoal;
  dueReviewIds: readonly string[];
  dueMistakeIds: readonly number[];
  nextSegment: Segment | null;
  skillTask: SkillTask | null;
}

export function buildSession(input: SessionInput): SessionStep[] {
  const steps: SessionStep[] = [];
  const reviews = input.dueReviewIds.slice(0, REVIEW_BUDGET[input.goal]);
  if (reviews.length > 0) steps.push({ kind: 'review', itemIds: reviews });
  const mistakes = input.dueMistakeIds.slice(0, MISTAKES_PER_SESSION);
  if (mistakes.length > 0) steps.push({ kind: 'mistakes', mistakeIds: mistakes });
  if (input.nextSegment) steps.push({ kind: 'lesson', segment: input.nextSegment });
  if (input.skillTask) steps.push({ kind: 'skill', task: input.skillTask });
  return steps;
}

/** Rotates listening → reading → structures → writing → speaking, one per day. */
const ROTATION: readonly Skill[] = ['listening', 'reading', 'structures', 'writing', 'speaking'];

export function skillForDay(dayNumber: number): Skill {
  return ROTATION[((dayNumber % ROTATION.length) + ROTATION.length) % ROTATION.length];
}

export interface SkillCandidate {
  itemId: string;
  title: string;
  skill: Skill;
  /** Lower is preferred (current unit first). */
  unitOrder: number;
  lastDoneAt: number | null;
}

/**
 * Picks a skill task: something not done yet from the earliest open unit, otherwise
 * the item done longest ago.
 */
export function pickSkillTask(skill: Skill, candidates: readonly SkillCandidate[]): SkillTask | null {
  const ofSkill = candidates.filter((c) => c.skill === skill);
  const fresh = ofSkill.filter((c) => c.lastDoneAt === null).sort((a, b) => a.unitOrder - b.unitOrder);
  const stale = ofSkill
    .filter((c) => c.lastDoneAt !== null)
    .sort((a, b) => (a.lastDoneAt ?? 0) - (b.lastDoneAt ?? 0));
  const chosen = fresh[0] ?? stale[0];
  return chosen ? { skill, itemId: chosen.itemId, title: chosen.title } : null;
}

/** Summary line such as "6 reviews · 1 lesson · 1 listening". */
export function describeSession(steps: readonly SessionStep[]): string {
  const parts = steps.map((s) => {
    switch (s.kind) {
      case 'review':
        return `${s.itemIds.length} review${s.itemIds.length === 1 ? '' : 's'}`;
      case 'mistakes':
        return `${s.mistakeIds.length} mistake${s.mistakeIds.length === 1 ? '' : 's'}`;
      case 'lesson':
        return '1 lesson';
      case 'skill':
        return `1 ${s.task.skill}`;
    }
  });
  return parts.length > 0 ? parts.join(' · ') : 'All done for today';
}
