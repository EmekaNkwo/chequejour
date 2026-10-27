/**
 * Mock test scoring. Listening and reading questions earn more points the harder
 * they are, as on the TCF, so the score reflects how far up the difficulty scale the
 * learner got rather than a plain percentage. Writing and speaking are self-assessed
 * against each task's checklist; later tasks are harder and weigh more.
 *
 * These are practice scores only, never official TCF results.
 */
import type { CefrBand, MockQuestion } from '../content-types';
import type { TcfSkill } from './exam-format';

/** Points per correct answer by difficulty band. */
export const BAND_POINTS: Readonly<Record<CefrBand, number>> = { A1: 1, A2: 2, B1: 3, B2: 4 };

/** Weight of tasks 1, 2 and 3 in a writing or speaking test. */
export const TASK_WEIGHTS: readonly number[] = [1, 2, 3];

export interface QuestionAnswer {
  questionId: string;
  /** Index picked, or null when time ran out first. */
  picked: number | null;
}

export interface ComprehensionScore {
  correct: number;
  total: number;
  /** 0–1: points earned / points available. */
  score: number;
}

export function scoreComprehension(questions: readonly MockQuestion[], answers: readonly QuestionAnswer[]): ComprehensionScore {
  const picked = new Map(answers.map((a) => [a.questionId, a.picked]));
  const right = questions.filter((q) => picked.get(q.id) === q.answer);
  const available = questions.reduce((n, q) => n + BAND_POINTS[q.band], 0);
  const earned = right.reduce((n, q) => n + BAND_POINTS[q.band], 0);
  return { correct: right.length, total: questions.length, score: available > 0 ? earned / available : 0 };
}

/**
 * Self-assessed task scores (each 0–1, the share of checklist points met, null when
 * the task was skipped) combined with task 3 weighing most.
 */
export function scoreTasks(taskScores: readonly (number | null)[]): number {
  const total = TASK_WEIGHTS.slice(0, taskScores.length).reduce((n, w) => n + w, 0);
  const earned = taskScores.reduce<number>((n, s, i) => n + (s ?? 0) * (TASK_WEIGHTS[i] ?? 1), 0);
  return total > 0 ? Math.min(1, Math.max(0, earned / total)) : 0;
}

/** Share of checklist items ticked. */
export function checklistScore(checked: readonly boolean[]): number {
  return checked.length > 0 ? checked.filter(Boolean).length / checked.length : 0;
}

/** One stored mock run: the tests taken and each one's 0–1 score. */
export type MockSkillScores = Partial<Record<TcfSkill, number>>;

export interface MockRunRecord {
  mockId: string;
  scores: MockSkillScores;
  takenAt: number;
}

/** Old results also stored a "structures" section, which TCF Canada doesn't have. */
export function tcfScores(sectionScores: Readonly<Record<string, number>>): MockSkillScores {
  const out: MockSkillScores = {};
  for (const skill of ['listening', 'reading', 'writing', 'speaking'] as const) {
    const v = sectionScores[skill];
    if (typeof v === 'number' && Number.isFinite(v)) out[skill] = Math.min(1, Math.max(0, v));
  }
  return out;
}

export interface ReviewItem {
  questionId: string;
  question: string;
  /** null when not answered (time ran out or the test was ended early). */
  yours: string | null;
  correct: string;
  explanation: string;
  band: CefrBand;
}

/** Questions answered wrongly or not at all, for the results review. */
export function reviewItems(questions: readonly MockQuestion[], answers: readonly QuestionAnswer[]): ReviewItem[] {
  const picked = new Map(answers.map((a) => [a.questionId, a.picked]));
  return questions
    .filter((q) => picked.get(q.id) !== q.answer)
    .map((q) => {
      const p = picked.get(q.id);
      return {
        questionId: q.id,
        question: q.question,
        yours: p === null || p === undefined ? null : (q.options[p] ?? null),
        correct: q.options[q.answer] ?? '',
        explanation: q.explanation,
        band: q.band,
      };
    });
}
