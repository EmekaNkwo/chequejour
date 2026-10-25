/**
 * Today's automatic session and the review queue.
 */
import type { ContentRepository } from '../../data/content-repo';
import type { Mistake, ProgressRepository } from '../../data/progress-repo';
import type { Exercise, McqExercise, Skill } from '../../domain/content-types';
import { dayNumber, type DayKey } from '../../domain/dates';
import { buildSession, pickSkillTask, skillForDay, type DailyGoal, type SessionStep, type SkillCandidate } from '../../domain/session';
import { isMastered, newCard, reviewCard, type ReviewGrade, type SrsCard } from '../../domain/srs';
import { toDayKey } from '../../domain/dates';
import type { PathState } from '../path/path-service';

/** Structures practice for the skill rotation: the current unit's checkpoint-style drill. */
const STRUCTURES_TASK_PREFIX = 'structures:';

/**
 * Units before the placement start stay open for revision, but they are only
 * picked once nothing is left from the placement start onwards.
 */
const BEFORE_PLACEMENT_PENALTY = 1000;

export async function skillCandidates(content: ContentRepository, progress: ProgressRepository, path: PathState): Promise<SkillCandidate[]> {
  const open = new Set(path.units.filter((u) => u.status !== 'locked').map((u) => u.id));
  const priority = (order: number): number => (order < path.placementStart ? order + BEFORE_PLACEMENT_PENALTY : order);
  const [items, done] = await Promise.all([content.skillItems(), progress.skillProgress()]);
  const fromItems = items
    .filter((i) => open.has(i.unitId))
    .map((i) => ({ itemId: i.id, title: i.title, skill: i.kind as Skill, unitOrder: priority(i.unitOrder), lastDoneAt: done.get(i.id)?.lastDoneAt ?? null }));
  const structures = path.units
    .filter((u) => open.has(u.id))
    .map((u) => {
      const id = `${STRUCTURES_TASK_PREFIX}${u.id}`;
      return { itemId: id, title: `Grammar drill · ${u.theme}`, skill: 'structures' as const, unitOrder: priority(u.order), lastDoneAt: done.get(id)?.lastDoneAt ?? null };
    });
  return [...fromItems, ...structures];
}

export function structuresUnitId(taskItemId: string): string | null {
  return taskItemId.startsWith(STRUCTURES_TASK_PREFIX) ? taskItemId.slice(STRUCTURES_TASK_PREFIX.length) : null;
}

export async function todaySession(
  content: ContentRepository,
  progress: ProgressRepository,
  path: PathState,
  goal: DailyGoal,
  today: DayKey,
  now: number,
): Promise<SessionStep[]> {
  const [due, mistakes, candidates] = await Promise.all([
    progress.dueCards(now),
    progress.dueMistakes(now),
    skillCandidates(content, progress, path),
  ]);
  const skill = skillForDay(dayNumber(today));
  return buildSession({
    goal,
    dueReviewIds: due.map((c) => c.itemId),
    dueMistakeIds: mistakes.map((m) => m.id),
    nextSegment: path.nextSegment,
    skillTask: pickSkillTask(skill, candidates),
  });
}

export async function gradeReview(progress: ProgressRepository, card: SrsCard, grade: ReviewGrade, now: number): Promise<SrsCard> {
  const next = reviewCard(card, grade, now);
  await progress.saveReview(next, grade, now);
  await progress.addStudy(toDayKey(new Date(now)), { reviews: 1 });
  return next;
}

/** Puts a lesson's words into the review queue. */
export async function learnWords(progress: ProgressRepository, wordIds: readonly string[], now: number): Promise<number> {
  return progress.addCards(
    wordIds.map((id) => newCard(id, 'word', now)),
    now,
  );
}

export async function masteredIds(progress: ProgressRepository): Promise<Set<string>> {
  const cards = await progress.allCards();
  return new Set(cards.filter(isMastered).map((c) => c.itemId));
}

/**
 * Rebuilds a mistake as an exercise. Comprehension questions are turned into a
 * multiple-choice question that names the text they came from.
 */
export async function mistakeExercise(content: ContentRepository, mistake: Mistake): Promise<Exercise | null> {
  const direct = (await content.item('exercise', mistake.itemId)) ?? (await content.item('checkpoint', mistake.itemId));
  if (direct) return direct;
  const match = /^(.*)-q\d+$/.exec(mistake.itemId);
  if (!match) return null;
  const parentId = match[1];
  const parent = (await content.item('listening', parentId)) ?? (await content.item('reading', parentId));
  if (!parent) return null;
  const q = parent.questions.find((x) => x.id === mistake.itemId);
  if (!q) return null;
  const isListening = 'lines' in parent;
  const mcq: McqExercise = {
    id: q.id,
    type: 'mcq',
    level: parent.level,
    skill: isListening ? 'listening' : 'reading',
    grammarTag: 'vocabulary',
    prompt: `${isListening ? 'Listening' : 'Reading'} · ${parent.title}: ${q.question}`,
    promptFr: isListening ? undefined : parent.text,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
  };
  return mcq;
}
