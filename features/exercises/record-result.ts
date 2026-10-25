/**
 * Records an answer: attempt history, study counters, the mistake notebook, and the
 * linked review card when the exercise practises a word.
 */
import type { ProgressRepository, AttemptInput } from '../../data/progress-repo';
import { canonicalAnswer, promptText, type AnswerResult } from '../../domain/answers';
import type { Exercise, Level, Skill } from '../../domain/content-types';
import { toDayKey } from '../../domain/dates';

export interface ResultInput {
  exercise: Exercise;
  result: AnswerResult;
  userAnswer: string;
  context: AttemptInput['context'];
  unitId: string | null;
  now: number;
}

const UNREVIEWABLE_CONTEXTS: ReadonlySet<AttemptInput['context']> = new Set(['daily', 'mock']);

export async function recordExerciseResult(progress: ProgressRepository, input: ResultInput): Promise<void> {
  const { exercise, result, now } = input;
  const correct = result !== 'wrong';
  await progress.recordAttempt({
    itemId: exercise.id,
    unitId: input.unitId,
    skill: exercise.skill,
    grammarTag: exercise.grammarTag,
    level: exercise.level,
    correct,
    context: input.context,
    at: now,
  });
  await progress.addStudy(toDayKey(new Date(now)), { exercises: 1 });
  if (input.context === 'placement') return;
  if (input.context === 'mistakes') {
    // retryMistake already reschedules a wrong retry; recording it again would double-count.
    await progress.retryMistake(exercise.id, correct, now);
    return;
  }
  // Daily checks and mock questions are built on the fly and aren't stored as content,
  // so the mistakes review couldn't rebuild them.
  if (!correct && !UNREVIEWABLE_CONTEXTS.has(input.context)) {
    await progress.recordMistake({
      itemId: exercise.id,
      skill: exercise.skill,
      grammarTag: exercise.grammarTag,
      prompt: promptText(exercise),
      userAnswer: input.userAnswer,
      correctAnswer: canonicalAnswer(exercise),
      explanation: exercise.explanation,
      at: now,
    });
  }
}

/** Comprehension questions belong to a listening or reading item. */
export async function recordComprehension(
  progress: ProgressRepository,
  input: {
    questionId: string;
    skill: Extract<Skill, 'listening' | 'reading'>;
    level: Level;
    unitId: string | null;
    correct: boolean;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    explanation: string;
    context: AttemptInput['context'];
    now: number;
  },
): Promise<void> {
  await progress.recordAttempt({
    itemId: input.questionId,
    unitId: input.unitId,
    skill: input.skill,
    grammarTag: null,
    level: input.level,
    correct: input.correct,
    context: input.context,
    at: input.now,
  });
  if (!input.correct && input.context !== 'mock') {
    await progress.recordMistake({
      itemId: input.questionId,
      skill: input.skill,
      grammarTag: null,
      prompt: input.question,
      userAnswer: input.userAnswer,
      correctAnswer: input.correctAnswer,
      explanation: input.explanation,
      at: input.now,
    });
  }
}
