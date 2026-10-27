import type { ContentRepository } from '../../data/content-repo';
import type { ProgressRepository } from '../../data/progress-repo';
import type { Level } from '../../domain/content-types';
import { currentUnitId, placementStartFor, unitStatuses } from '../../domain/unit-path';
import type { DailyLearner } from './daily-service';

/** Open units and the current unit's level, without loading the whole path. */
export async function learnerFor(content: ContentRepository, progress: ProgressRepository, placement: Level | null): Promise<DailyLearner> {
  const [units, unitProgress] = await Promise.all([content.units(), progress.unitProgress()]);
  const placementStart = placementStartFor(placement);
  const statuses = unitStatuses(units, unitProgress, placementStart);
  const currentId = currentUnitId(units, statuses, placementStart);
  return {
    openUnitIds: units.filter((u) => statuses.get(u.id) !== 'locked').map((u) => u.id),
    level: units.find((u) => u.id === currentId)?.level ?? 'A2',
  };
}
