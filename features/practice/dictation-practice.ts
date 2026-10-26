import type { ContentRepository } from '../../data/content-repo';
import type { ProgressRepository } from '../../data/progress-repo';
import type { Exercise, Level } from '../../domain/content-types';
import { seededShuffle } from '../../domain/shuffle';
import { learnerFor } from '../daily/daily-learner';

export const DICTATION_SET_SIZE = 5;

/** A short set of dictations from the units the learner can open. */
export async function dictationSet(content: ContentRepository, progress: ProgressRepository, placement: Level | null, seed: string, size: number = DICTATION_SET_SIZE): Promise<Exercise[]> {
  const { openUnitIds } = await learnerFor(content, progress, placement);
  const open = new Set(openUnitIds);
  const units = await Promise.all([...open].map((id) => content.unit(id)));
  const dictations = units.flatMap((u) => (u ? u.exercises.filter((e) => e.type === 'dictation') : []));
  return seededShuffle(dictations, seed).slice(0, size);
}
