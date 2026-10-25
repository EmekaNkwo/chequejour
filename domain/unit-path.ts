/**
 * The learning path: units unlock in order, and each unit is taught as a sequence of
 * short lesson segments followed by a checkpoint quiz.
 */
import type { Level, Unit } from './content-types';

export const CHECKPOINT_PASS = 0.7;
export const WORDS_PER_SEGMENT = 10;
export const EXERCISES_PER_SEGMENT = 10;

export type SegmentKind = 'grammar' | 'words' | 'exercises';

export interface Segment {
  /** Stable id stored in progress, e.g. "u03:words:1". */
  id: string;
  unitId: string;
  kind: SegmentKind;
  title: string;
  /** Grammar lesson id, word ids or exercise ids. */
  itemIds: string[];
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));
}

/** Grammar lessons and core-word batches interleaved with practice sets. */
export function unitSegments(unit: Unit): Segment[] {
  const wordBatches = chunk(
    unit.vocab.filter((v) => v.core).map((v) => v.id),
    WORDS_PER_SEGMENT,
  );
  const exerciseBatches = chunk(
    unit.exercises.map((e) => e.id),
    EXERCISES_PER_SEGMENT,
  );
  const rounds = Math.max(unit.grammar.length, wordBatches.length, exerciseBatches.length);
  const segments: Segment[] = [];
  for (let i = 0; i < rounds; i += 1) {
    const words = wordBatches[i];
    if (words) {
      segments.push({ id: `${unit.id}:words:${i + 1}`, unitId: unit.id, kind: 'words', title: `New words ${i + 1}`, itemIds: words });
    }
    const lesson = unit.grammar[i];
    if (lesson) {
      segments.push({ id: `${unit.id}:grammar:${i + 1}`, unitId: unit.id, kind: 'grammar', title: lesson.title, itemIds: [lesson.id] });
    }
    const exercises = exerciseBatches[i];
    if (exercises) {
      segments.push({ id: `${unit.id}:exercises:${i + 1}`, unitId: unit.id, kind: 'exercises', title: `Practice ${i + 1}`, itemIds: exercises });
    }
  }
  return segments;
}

export function nextSegment(unit: Unit, completed: ReadonlySet<string>): Segment | null {
  return unitSegments(unit).find((s) => !completed.has(s.id)) ?? null;
}

export interface UnitProgressInput {
  unitId: string;
  checkpointScore: number | null;
}

export type UnitStatus = 'locked' | 'available' | 'completed';

/** Placement can open the path further along; earlier units stay available. */
export const PLACEMENT_START_UNIT: Readonly<Record<Level, number>> = { A2: 1, 'A2+': 6, B1: 11 };

export function isPassed(score: number | null): boolean {
  return score !== null && score >= CHECKPOINT_PASS;
}

/**
 * A unit is completed once its checkpoint is passed. A unit is available if it is at or
 * before the placement start, or the previous unit is completed.
 */
export function unitStatuses(
  units: readonly Pick<Unit, 'id' | 'order'>[],
  progress: ReadonlyMap<string, UnitProgressInput>,
  placementStart: number,
): Map<string, UnitStatus> {
  const sorted = [...units].sort((a, b) => a.order - b.order);
  const statuses = new Map<string, UnitStatus>();
  sorted.forEach((unit, index) => {
    if (isPassed(progress.get(unit.id)?.checkpointScore ?? null)) {
      statuses.set(unit.id, 'completed');
      return;
    }
    const previous = sorted[index - 1];
    const open =
      index === 0 || unit.order <= placementStart || (previous !== undefined && statuses.get(previous.id) === 'completed');
    statuses.set(unit.id, open ? 'available' : 'locked');
  });
  return statuses;
}

/** The learner's current unit: the first available, not-yet-completed unit. */
export function currentUnitId(
  units: readonly Pick<Unit, 'id' | 'order'>[],
  statuses: ReadonlyMap<string, UnitStatus>,
  placementStart: number,
): string | null {
  const sorted = [...units].sort((a, b) => a.order - b.order);
  const fromPlacement = sorted.find((u) => u.order >= placementStart && statuses.get(u.id) === 'available');
  const firstOpen = sorted.find((u) => statuses.get(u.id) === 'available');
  return (fromPlacement ?? firstOpen ?? sorted[sorted.length - 1])?.id ?? null;
}
