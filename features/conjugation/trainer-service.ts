/**
 * Conjugation trainer: loads a session at the learner's level and saves each answer to
 * the form's review schedule and the attempt history. Wrong forms don't go to the
 * mistakes notebook: the trainer's own schedule brings them back.
 */
import { ConjugationRepository } from '../../data/conjugation-repo';
import type { AnswerResult } from '../../domain/answers';
import { buildTrainerSession, conjKey, dueCount, recordAnswer, tenseStats, type ConjItem, type TenseStat } from '../../domain/conjugation-trainer';
import type { ConjugationExercise, Level } from '../../domain/content-types';
import { toDayKey } from '../../domain/dates';
import { findVerb } from '../../domain/exercises/conjugation-tables';
import { conjugationExercise, TENSE_TAG } from '../../domain/verb-of-day';
import type { AppServices } from '../app/AppContext';
import { learnerFor } from '../daily/daily-learner';

type TrainerApp = Pick<AppServices, 'db' | 'content' | 'progress' | 'settings'>;

export interface TrainerSession {
  level: Level;
  items: ConjItem[];
  exercises: ConjugationExercise[];
}

export function trainerExercise(item: ConjItem): ConjugationExercise | null {
  const verb = findVerb(item.verb);
  return verb ? conjugationExercise(verb, item, `conj:${conjKey(item)}`) : null;
}

export async function loadTrainer(app: TrainerApp, options: { now: number; seed: string; verb?: string }): Promise<TrainerSession> {
  const [{ level }, records] = await Promise.all([learnerFor(app.content, app.progress, app.settings.placementLevel), new ConjugationRepository(app.db).all()]);
  const built = buildTrainerSession({ level, records, now: options.now, seed: options.seed, verb: options.verb });
  const pairs = built.map((item) => ({ item, exercise: trainerExercise(item) })).filter((p): p is { item: ConjItem; exercise: ConjugationExercise } => p.exercise !== null);
  return { level, items: pairs.map((p) => p.item), exercises: pairs.map((p) => p.exercise) };
}

export async function saveTrainerAnswer(app: Pick<AppServices, 'db' | 'progress'>, item: ConjItem, result: AnswerResult, now: number): Promise<void> {
  const repo = new ConjugationRepository(app.db);
  const key = conjKey(item);
  await repo.save(recordAnswer(await repo.get(key), key, result, now), now);
  await app.progress.recordAttempt({
    itemId: `conj:${key}`,
    unitId: null,
    skill: 'structures',
    grammarTag: TENSE_TAG[item.tense],
    level: findVerb(item.verb)?.level ?? 'A2',
    correct: result !== 'wrong',
    context: 'practice',
    at: now,
  });
  await app.progress.addStudy(toDayKey(new Date(now)), { exercises: 1 });
}

export interface TrainerOverview {
  due: number;
  stats: TenseStat[];
}

export async function trainerOverview(app: Pick<AppServices, 'db'>, now: number): Promise<TrainerOverview> {
  const records = await new ConjugationRepository(app.db).all();
  return { due: dueCount(records, now), stats: tenseStats(records) };
}
