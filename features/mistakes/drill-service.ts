/**
 * "Drill my weakest point": a short quiz on one grammar point, made from the learner's
 * open mistakes on it plus other course exercises that practise the same point.
 */
import type { ContentRepository } from '../../data/content-repo';
import type { ProgressRepository } from '../../data/progress-repo';
import type { Exercise, GrammarTag } from '../../domain/content-types';
import { drillPlan, weakestPoint, type GrammarGroup } from '../../domain/mistakes';
import { mistakeExercise } from '../session/session-service';

export async function weakestMistakePoint(progress: ProgressRepository): Promise<GrammarGroup | null> {
  return weakestPoint(await progress.mistakes());
}

export async function buildDrill(content: ContentRepository, progress: ProgressRepository, tag: GrammarTag, seed: string): Promise<Exercise[]> {
  const [mistakes, exercises] = await Promise.all([progress.mistakes(), content.listKind('exercise')]);
  const ids = drillPlan(tag, mistakes, exercises, seed);
  const byId = new Map(exercises.map((e) => [e.id, e] as const));
  const fromMistakes = new Map(mistakes.map((m) => [m.itemId, m] as const));
  const built = await Promise.all(
    ids.map(async (id) => {
      const own = fromMistakes.get(id);
      // Checkpoint mistakes aren't in the exercise list, so they are rebuilt like in the review.
      return byId.get(id) ?? (own ? mistakeExercise(content, own) : null);
    }),
  );
  return built.filter((e): e is Exercise => e !== null);
}
