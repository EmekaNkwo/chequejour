/**
 * Translation answers are checked against every accepted answer in the content file.
 * Into English, contractions are expanded first, so "I'm" and "I am" are the same.
 */
import { checkTyped, type CheckOutcome } from '../answers';
import type { TranslateExercise } from '../content-types';

const CONTRACTIONS: readonly [RegExp, string][] = [
  [/\bcan't\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/\bshan't\b/g, 'shall not'],
  [/\b(\w+)n't\b/g, '$1 not'],
  [/\bi'm\b/g, 'i am'],
  [/\b(you|we|they)'re\b/g, '$1 are'],
  [/\b(i|you|we|they|he|she|it)'ve\b/g, '$1 have'],
  [/\b(i|you|we|they|he|she|it)'ll\b/g, '$1 will'],
  [/\b(i|you|we|they|he|she|it)'d\b/g, '$1 would'],
  [/\b(he|she|it|that|there|what|who|where|here)'s\b/g, '$1 is'],
  [/\blet's\b/g, 'let us'],
];

export function expandContractions(text: string): string {
  const lower = text.toLowerCase().replace(/[’‘]/g, "'");
  return CONTRACTIONS.reduce((s, [re, to]) => s.replace(re, to), lower).replace(/\bcannot\b/g, 'can not');
}

export function checkTranslation(answer: string, accepted: readonly string[], direction: TranslateExercise['direction']): CheckOutcome {
  if (direction === 'en-fr') return checkTyped(answer, accepted);
  const outcome = checkTyped(expandContractions(answer), accepted.map(expandContractions));
  // Show the content's own wording, not the expanded form.
  return { ...outcome, expected: accepted[0] ?? outcome.expected };
}
