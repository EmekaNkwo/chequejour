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

export interface WordRange {
  minWords: number;
  maxWords: number;
}

/**
 * What to point out before the learner hands in: empty tasks and texts outside their
 * word range. Null when every text is within range.
 */
export function handInWarning(texts: readonly string[], ranges: readonly WordRange[]): string | null {
  const notes = ranges.flatMap((range, i) => {
    const words = countWords(texts[i] ?? '');
    const name = ranges.length > 1 ? `Task ${i + 1}` : 'Your text';
    const of = `(${words} of ${range.minWords}–${range.maxWords} words)`;
    switch (wordRangeStatus(words, range.minWords, range.maxWords)) {
      case 'empty':
        return [`${name} is empty.`];
      case 'under':
        return [`${name} is short ${of}.`];
      case 'over':
        return [`${name} is long ${of}.`];
      default:
        return [];
    }
  });
  return notes.length > 0 ? notes.join(' ') : null;
}
