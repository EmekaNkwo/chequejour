/**
 * The learner's position on the A2 → B1 path.
 */
import type { ContentRepository, UnitSummary } from '../../data/content-repo';
import type { ProgressRepository } from '../../data/progress-repo';
import type { DailyLearner } from '../daily/daily-service';
import type { Level } from '../../domain/content-types';
import { currentUnitId, nextSegment, placementStartFor, unitSegments, unitStatuses, type Segment, type UnitStatus } from '../../domain/unit-path';

export interface UnitOnPath extends UnitSummary {
  status: UnitStatus;
  segmentsDone: number;
  segmentsTotal: number;
  /** Core words with a mastered card. */
  masteredWords: number;
  coreWords: number;
  checkpointScore: number | null;
}

export interface PathState {
  units: UnitOnPath[];
  current: UnitOnPath | null;
  nextSegment: Segment | null;
  completedSegments: Set<string>;
  placementStart: number;
}

export async function loadPath(
  content: ContentRepository,
  progress: ProgressRepository,
  placement: Level | null,
  masteredIds: ReadonlySet<string>,
): Promise<PathState> {
  const [units, unitProgress, completedSegments] = await Promise.all([
    content.units(),
    progress.unitProgress(),
    progress.completedSegments(),
  ]);
  const placementStart = placementStartFor(placement);
  const statuses = unitStatuses(units, unitProgress, placementStart);
  const currentId = currentUnitId(units, statuses, placementStart);

  const onPath = await Promise.all(
    units.map(async (u): Promise<UnitOnPath> => {
      const full = await content.unit(u.id);
      const segments = full ? unitSegments(full) : [];
      const core = full ? full.vocab.filter((v) => v.core) : [];
      return {
        ...u,
        status: statuses.get(u.id) ?? 'locked',
        segmentsDone: segments.filter((s) => completedSegments.has(s.id)).length,
        segmentsTotal: segments.length,
        masteredWords: core.filter((v) => masteredIds.has(v.id)).length,
        coreWords: core.length,
        checkpointScore: unitProgress.get(u.id)?.checkpointScore ?? null,
      };
    }),
  );
  const current = onPath.find((u) => u.id === currentId) ?? null;
  const currentFull = current ? await content.unit(current.id) : null;
  return {
    units: onPath,
    current,
    nextSegment: currentFull ? nextSegment(currentFull, completedSegments) : null,
    completedSegments,
    placementStart,
  };
}

/** Units the learner can open, used to choose words of the day and skill tasks. */
export function openUnitIds(path: PathState): string[] {
  return path.units.filter((u) => u.status !== 'locked').map((u) => u.id);
}

/** What the daily word and sentence are chosen from: open units and the current unit's level. */
export function dailyLearner(path: PathState): DailyLearner {
  return { openUnitIds: openUnitIds(path), level: path.current?.level ?? path.units[path.units.length - 1]?.level ?? 'A2' };
}
