/**
 * Word counting as the TCF does it: a word is whatever sits between two spaces, so
 * "c'est" and "aujourd'hui" count once. Punctuation standing alone (French puts spaces
 * before ? ! : ;) is not a word.
 */
const PUNCTUATION_ONLY = /^[\p{P}\p{S}]+$/u;

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0 && !PUNCTUATION_ONLY.test(token)).length;
}

export type WordRangeStatus = 'empty' | 'under' | 'within' | 'over';

export function wordRangeStatus(words: number, minWords: number, maxWords: number): WordRangeStatus {
  if (words === 0) return 'empty';
  if (words < minWords) return 'under';
  if (words > maxWords) return 'over';
  return 'within';
}
