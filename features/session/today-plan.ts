/**
 * Today's session is planned once per day and stored, so its progress ring moves
 * forward as steps are done instead of being recalculated from a shrinking queue.
 */
import { z } from 'zod';
import type { ContentRepository } from '../../data/content-repo';
import type { ProgressRepository } from '../../data/progress-repo';
import { fromDayKey, type DayKey } from '../../domain/dates';
import { describeSession, type DailyGoal, type SessionStep } from '../../domain/session';
import type { PathState } from '../path/path-service';
import { todaySession } from './session-service';

const stepSchema: z.ZodType<SessionStep> = z.union([
  z.object({ kind: z.literal('review'), itemIds: z.array(z.string()) }),
  z.object({ kind: z.literal('mistakes'), mistakeIds: z.array(z.number()) }),
  z.object({
    kind: z.literal('lesson'),
    segment: z.object({
      id: z.string(),
      unitId: z.string(),
      kind: z.enum(['grammar', 'words', 'exercises']),
      title: z.string(),
      itemIds: z.array(z.string()),
    }),
  }),
  z.object({
    kind: z.literal('skill'),
    task: z.object({ skill: z.enum(['listening', 'reading', 'structures', 'writing', 'speaking']), itemId: z.string(), title: z.string() }),
  }),
]);

const planKey = (day: DayKey): string => `session:${day}`;

export interface PlannedStep {
  step: SessionStep;
  done: boolean;
}

export interface TodayPlan {
  day: DayKey;
  steps: PlannedStep[];
  /** 0–1 share of steps done; 1 when there was nothing to do. */
  completion: number;
  summary: string;
  remaining: string;
}

async function loadOrCreate(
  content: ContentRepository,
  progress: ProgressRepository,
  path: PathState,
  goal: DailyGoal,
  day: DayKey,
  now: number,
): Promise<SessionStep[]> {
  const stored = await progress.meta(planKey(day));
  if (stored) {
    try {
      const parsed = z.array(stepSchema).safeParse(JSON.parse(stored));
      if (parsed.success) return parsed.data;
    } catch {
      // fall through and rebuild
    }
  }
  const steps = await todaySession(content, progress, path, goal, day, now);
  await progress.setMeta(planKey(day), JSON.stringify(steps));
  return steps;
}

async function isDone(progress: ProgressRepository, step: SessionStep, path: PathState, dayStart: number, now: number): Promise<boolean> {
  switch (step.kind) {
    case 'review': {
      const reviewed = await progress.reviewsSince(dayStart);
      const stillDue = (await progress.dueCards(now)).filter((c) => step.itemIds.includes(c.itemId)).length;
      return reviewed >= step.itemIds.length || stillDue === 0;
    }
    case 'mistakes': {
      const due = new Set((await progress.dueMistakes(now)).map((m) => m.id));
      return step.mistakeIds.every((id) => !due.has(id));
    }
    case 'lesson':
      return path.completedSegments.has(step.segment.id);
    case 'skill': {
      const done = (await progress.skillProgress()).get(step.task.itemId);
      return (done?.lastDoneAt ?? 0) >= dayStart;
    }
  }
}

export async function todayPlan(
  content: ContentRepository,
  progress: ProgressRepository,
  path: PathState,
  goal: DailyGoal,
  day: DayKey,
  now: number,
): Promise<TodayPlan> {
  const steps = await loadOrCreate(content, progress, path, goal, day, now);
  const dayStart = fromDayKey(day).getTime();
  const planned = await Promise.all(steps.map(async (step) => ({ step, done: await isDone(progress, step, path, dayStart, now) })));
  const doneCount = planned.filter((p) => p.done).length;
  return {
    day,
    steps: planned,
    completion: planned.length === 0 ? 1 : doneCount / planned.length,
    summary: describeSession(steps),
    remaining: describeSession(planned.filter((p) => !p.done).map((p) => p.step)),
  };
}

/** Replans today, e.g. after placement or when the learner wants more. */
export async function resetTodayPlan(progress: ProgressRepository, day: DayKey): Promise<void> {
  await progress.setMeta(planKey(day), '');
}
