/**
 * Conjugation trainer: every verb + tense + person the learner has typed is a
 * spaced-repetition card, so forms they get wrong come back soon and forms they know
 * fade out. A session is:
 *   1. forms that are due, oldest first;
 *   2. then new forms, taking one tense at a time in turn, weakest tense first;
 *   3. then, if there is still room (e.g. one verb fully learned), forms due soonest,
 *      practised ahead of time.
 * New forms only come from the learner's verbs and tenses (see verb-of-day.ts).
 */
import type { AnswerResult } from './answers';
import type { Level } from './content-types';
import { findVerb, PERSONS, TENSES, type Tense } from './exercises/conjugation-tables';
import { seededShuffle } from './shuffle';
import { isDue, newCard, reviewCard, type ReviewGrade, type SrsCard } from './srs';
import { quizTenses, verbPool } from './verb-of-day';

export const SESSION_SIZE = 10;
/** Accuracy assumed for a tense not practised yet: weaker than a mastered one, stronger than a struggling one. */
const UNSEEN_ACCURACY = 0.5;

export interface ConjItem {
  verb: string;
  tense: Tense;
  /** 0 (je) to 5 (ils). */
  person: number;
}

export interface ConjRecord {
  /** conjKey of the item. */
  key: string;
  card: SrsCard;
  attempts: number;
  correct: number;
}

export interface TenseStat {
  tense: Tense;
  attempts: number;
  correct: number;
  /** Share answered right; null before the first attempt. */
  accuracy: number | null;
  /** How many forms of this tense have been practised. */
  forms: number;
}

export const conjKey = ({ verb, tense, person }: ConjItem): string => `${verb}|${tense}|${person}`;

/** Keys come from storage or backups, so check every part. */
export function parseConjKey(key: string): ConjItem | null {
  const [verb, tense, person, extra] = key.split('|');
  const p = Number(person);
  if (extra !== undefined || !findVerb(verb ?? '') || !(TENSES as readonly string[]).includes(tense) || !Number.isInteger(p) || p < 0 || p >= PERSONS.length) return null;
  return { verb, tense: tense as Tense, person: p };
}

export function gradeFor(result: AnswerResult): ReviewGrade {
  return result === 'correct' ? 'good' : result === 'almost' ? 'hard' : 'again';
}

/** The record after one answer; `previous` is not modified. */
export function recordAnswer(previous: ConjRecord | null, key: string, result: AnswerResult, now: number): ConjRecord {
  const card = previous?.card ?? newCard(key, 'conjugation', now);
  return {
    key,
    card: reviewCard(card, gradeFor(result), now),
    attempts: (previous?.attempts ?? 0) + 1,
    correct: (previous?.correct ?? 0) + (result === 'wrong' ? 0 : 1),
  };
}

export function tenseStats(records: readonly ConjRecord[]): TenseStat[] {
  const parsed = records.map((r) => ({ r, item: parseConjKey(r.key) }));
  return TENSES.map((tense) => {
    const mine = parsed.filter((p) => p.item?.tense === tense).map((p) => p.r);
    const attempts = mine.reduce((n, r) => n + r.attempts, 0);
    const correct = mine.reduce((n, r) => n + r.correct, 0);
    return { tense, attempts, correct, accuracy: attempts > 0 ? correct / attempts : null, forms: mine.length };
  });
}

export interface SessionInput {
  level: Level;
  records: readonly ConjRecord[];
  now: number;
  /** Varies the order of new forms between sessions. */
  seed: string;
  size?: number;
  /** Only this verb, e.g. today's verb. */
  verb?: string;
}

/** Takes one item from each queue in turn until `count` are taken or all are empty. */
function roundRobin<T>(queues: readonly (readonly T[])[], count: number): T[] {
  const out: T[] = [];
  for (let round = 0; out.length < count && queues.some((q) => round < q.length); round += 1) {
    for (const q of queues) if (round < q.length && out.length < count) out.push(q[round]);
  }
  return out;
}

export function buildTrainerSession({ level, records, now, seed, size = SESSION_SIZE, verb }: SessionInput): ConjItem[] {
  const tenses = quizTenses(level);
  const verbs = verb ? (findVerb(verb) ? [verb] : []) : verbPool(level).map((v) => v.infinitive);
  const inScope = (i: ConjItem | null): i is ConjItem => i !== null && verbs.includes(i.verb) && tenses.includes(i.tense);
  const mine = records.map((r) => ({ card: r.card, item: parseConjKey(r.key) })).filter((x): x is { card: SrsCard; item: ConjItem } => inScope(x.item));
  const byDue = [...mine].sort((a, b) => a.card.due - b.card.due);

  const due = byDue.filter((x) => isDue(x.card, now)).map((x) => x.item);
  const known = new Set(records.map((r) => r.key));
  const accuracy = new Map(tenseStats(records).map((s) => [s.tense, s.accuracy ?? UNSEEN_ACCURACY]));
  const weakestFirst = [...tenses].sort((a, b) => (accuracy.get(a) ?? 0) - (accuracy.get(b) ?? 0) || tenses.indexOf(a) - tenses.indexOf(b));
  const queues = weakestFirst.map((tense) =>
    seededShuffle(
      verbs.flatMap((v) => PERSONS.map((_, person) => ({ verb: v, tense, person }))).filter((i) => !known.has(conjKey(i))),
      `${seed}:${tense}`,
    ),
  );
  const fresh = roundRobin(queues, Math.max(0, size - due.length));
  const ahead = byDue.filter((x) => !isDue(x.card, now)).map((x) => x.item);
  return [...due, ...fresh, ...ahead].slice(0, size);
}

/** How many forms are due now, for the Practice tab. */
export function dueCount(records: readonly ConjRecord[], now: number): number {
  return records.filter((r) => isDue(r.card, now) && parseConjKey(r.key) !== null).length;
}
