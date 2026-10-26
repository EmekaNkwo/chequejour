/**
 * Answer checking for typed and selected exercise answers.
 */
import type { Exercise } from './content-types';

export type AnswerResult = 'correct' | 'almost' | 'wrong';

export interface CheckOutcome {
  result: AnswerResult;
  /** Canonical answer to display. */
  expected: string;
  /** Set when the answer was right apart from accents. */
  note?: string;
}

/**
 * Lower-cases, unifies apostrophes, drops punctuation (keeping apostrophes and
 * hyphens, which change meaning) and collapses spaces.
 */
export function normalize(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[«»"“”.,;:!?…()]/g, ' ')
    .replace(/\s*'\s*/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripAccents(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');
}

export function checkTyped(answer: string, accepted: readonly string[]): CheckOutcome {
  const expected = accepted[0] ?? '';
  const given = normalize(answer);
  if (given.length === 0) return { result: 'wrong', expected };
  const normalized = accepted.map(normalize);
  if (normalized.includes(given)) return { result: 'correct', expected };
  const bare = stripAccents(given);
  const accentMatch = normalized.findIndex((a) => stripAccents(a) === bare);
  if (accentMatch >= 0) {
    return { result: 'almost', expected: accepted[accentMatch] ?? expected, note: 'Almost — check the accents.' };
  }
  return { result: 'wrong', expected };
}

export function checkChoice(selected: number, answer: number, options: readonly string[]): CheckOutcome {
  return { result: selected === answer ? 'correct' : 'wrong', expected: options[answer] ?? '' };
}

/** Reorder answers are compared as a sentence so equivalent spacing passes. */
export function checkReorder(order: readonly string[], tokens: readonly string[]): CheckOutcome {
  const expected = joinTokens(tokens);
  return checkTyped(joinTokens(order), [expected]);
}

/** Joins tokens, without a space after an elided word such as "l'" or "j'". */
export function joinTokens(tokens: readonly string[]): string {
  return tokens.reduce((acc, t) => (acc === '' ? t : /['’]$/.test(acc) ? `${acc}${t}` : `${acc} ${t}`), '');
}

/** Match answers: a map of left index → chosen right index. */
export function checkMatch(chosen: Readonly<Record<number, number>>, pairCount: number): CheckOutcome {
  const allRight = Array.from({ length: pairCount }, (_, i) => chosen[i] === i).every(Boolean);
  return { result: allRight ? 'correct' : 'wrong', expected: '' };
}

/** Canonical answer text for any exercise, used by the mistake notebook. */
export function canonicalAnswer(exercise: Exercise): string {
  switch (exercise.type) {
    case 'mcq':
      return exercise.options[exercise.answer] ?? '';
    case 'fill_blank':
      return exercise.sentence.replace('___', exercise.answers[0] ?? '');
    case 'conjugation':
      return `${exercise.person} ${exercise.answers[0] ?? ''}`;
    case 'reorder':
      return joinTokens(exercise.tokens);
    case 'match':
      return exercise.pairs.map((p) => `${p.left} → ${p.right}`).join(' · ');
    case 'translate':
      return exercise.answers[0] ?? '';
    case 'dictation':
      return exercise.text;
  }
}

/** Short prompt text for any exercise, used by the mistake notebook. */
export function promptText(exercise: Exercise): string {
  switch (exercise.type) {
    case 'mcq':
      return exercise.promptFr ? `${exercise.prompt} — ${exercise.promptFr}` : exercise.prompt;
    case 'fill_blank':
      return exercise.sentence;
    case 'conjugation':
      return `${exercise.verb} · ${exercise.tense} · ${exercise.person}`;
    case 'reorder':
      return exercise.translation;
    case 'match':
      return exercise.prompt;
    case 'translate':
      return exercise.source;
    case 'dictation':
      return 'Dictation';
  }
}
