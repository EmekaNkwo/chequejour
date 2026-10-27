/**
 * Spaced-repetition scheduler: a thin wrapper around ts-fsrs that stores cards as
 * plain serializable records (numbers instead of Dates) so they map to SQLite rows.
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

const STATES: readonly CardState[] = ['new', 'learning', 'review', 'relearning'];

export interface SrsCard {
  itemId: string;
  itemKind: 'word' | 'sentence';
  due: number;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview: number | null;
}

const GRADE_TO_RATING: Readonly<Record<ReviewGrade, Grade>> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

/** Desired retention 0.9 and a one-year cap suit a year-long A2→B1 course. */
const scheduler = fsrs(generatorParameters({ request_retention: 0.9, maximum_interval: 365, enable_fuzz: false }));

/** A card counts as mastered once it is in review with at least three weeks of stability. */
export const MASTERY_STABILITY_DAYS = 21;

function toFsrs(card: SrsCard): Card {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: 0,
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: STATES.indexOf(card.state),
    last_review: card.lastReview === null ? undefined : new Date(card.lastReview),
  };
}

function fromFsrs(base: Pick<SrsCard, 'itemId' | 'itemKind'>, card: Card): SrsCard {
  return {
    ...base,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: STATES[card.state] ?? 'new',
    lastReview: card.last_review ? card.last_review.getTime() : null,
  };
}

export function newCard(itemId: string, itemKind: SrsCard['itemKind'], now: number): SrsCard {
  return fromFsrs({ itemId, itemKind }, createEmptyCard(new Date(now)));
}

/** Returns the updated card; the input card is not modified. */
export function reviewCard(card: SrsCard, grade: ReviewGrade, now: number): SrsCard {
  const { card: next } = scheduler.next(toFsrs(card), new Date(now), GRADE_TO_RATING[grade]);
  return fromFsrs(card, next);
}

export function isDue(card: SrsCard, now: number): boolean {
  return card.due <= now;
}

export function isMastered(card: SrsCard): boolean {
  return card.state === 'review' && card.stability >= MASTERY_STABILITY_DAYS;
}

/** Due cards, most overdue first. */
export function dueCards(cards: readonly SrsCard[], now: number): SrsCard[] {
  return cards.filter((c) => isDue(c, now)).sort((a, b) => a.due - b.due);
}

/** Maps an exercise result onto a review grade. */
export function gradeFromResult(result: 'correct' | 'almost' | 'wrong'): ReviewGrade {
  if (result === 'correct') return 'good';
  if (result === 'almost') return 'hard';
  return 'again';
}
